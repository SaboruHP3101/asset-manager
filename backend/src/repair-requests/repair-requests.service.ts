import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { removeUploadedFiles } from '../attachments/upload-cleanup.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  CreateMyRepairRequestDto,
  UpdateMyRepairRequestDto,
} from './dto/create-my-repair-request.dto.js';
import {
  AssignRepairDto,
  CompleteRepairDto,
  ConfirmRepairDto,
  RepairDecisionDto,
  RepairHandoverDecisionDto,
} from './dto/repair-workflow.dto.js';
import { RepairRequest } from './entities/repair-request.entity.js';
import {
  assign,
  complete,
  confirmResult,
  receiveForRepair,
} from './repair-completion.js';
import {
  assertItHead,
  assertOwner,
  handoverSide,
  loadLockedRequest,
  lockAsset,
  logAction,
  requireOwnedItAsset,
} from './repair-context.js';
import {
  findItAssignees,
  findMine,
  findMyLatestByAsset,
  findMyProgress,
  findOneForActor,
  findQueue,
} from './repair-queries.js';

@Injectable()
export class RepairRequestsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly audit: RequestAuditService,
  ) {}
  findQueue(actor: AuthenticatedEmployee) {
    return findQueue(this.db, actor);
  }

  findItAssignees(actor: AuthenticatedEmployee) {
    return findItAssignees(this.db, actor);
  }

  findOneForActor(id: string, actor: AuthenticatedEmployee) {
    return findOneForActor(this.audit, this.db, id, actor);
  }

  findMyLatestByAsset(actor: AuthenticatedEmployee, assetId: string) {
    return findMyLatestByAsset(this.audit, this.db, actor, assetId);
  }

  findMine(employeeId: string) {
    return findMine(this.db, employeeId);
  }

  findMyProgress(employeeId: string, requestId: string) {
    return findMyProgress(this.audit, this.db, employeeId, requestId);
  }

  assign(id: string, dto: AssignRepairDto, actor: AuthenticatedEmployee) {
    return assign(this.audit, this.db, id, dto, actor);
  }

  complete(id: string, dto: CompleteRepairDto, actor: AuthenticatedEmployee) {
    return complete(this.audit, this.db, id, dto, actor);
  }

  confirmResult(
    id: string,
    dto: ConfirmRepairDto,
    actor: AuthenticatedEmployee,
  ) {
    return confirmResult(this.audit, this.db, id, dto, actor);
  }
  async createMine(
    actor: AuthenticatedEmployee,
    dto: CreateMyRepairRequestDto,
    files: Express.Multer.File[],
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        // Luồng thu hồi cũng khóa dòng tài sản trước khi kiểm tra phiếu đang mở.
        await lockAsset(tx, dto.assetId);
        // Lấy vị trí gốc để trả tài sản về sau và đọc đơn vị quản lý từ danh mục.
        const [asset] = await tx
          .select({
            id: schema.assets.id,
            currentLocation: schema.assets.currentLocation,
            managementOwner: schema.assetCategories.managementOwner,
          })
          .from(schema.assets)
          .innerJoin(
            schema.assetCategories,
            eq(schema.assets.assetCategoryId, schema.assetCategories.id),
          )
          .where(
            and(
              eq(schema.assets.id, dto.assetId),
              eq(schema.assets.currentUserId, actor.id),
            ),
          );

        // Phiếu chỉ dành cho tài sản IT đang giao cho chính người gửi phiếu.
        if (!asset || asset.managementOwner !== 'it') {
          throw new NotFoundException(
            'Chỉ có thể sửa chữa thiết bị điện tử đang được giao cho bạn.',
          );
        }

        // Mỗi tài sản chỉ có một luồng sửa chữa đang hoạt động.
        const [activeRequest] = await tx
          .select({ id: schema.repairRequests.id })
          .from(schema.repairRequests)
          .where(
            and(
              eq(schema.repairRequests.assetId, dto.assetId),
              notInArray(schema.repairRequests.status, ['closed', 'cancelled']),
            ),
          );

        // Báo xung đột để nhân viên tiếp tục trên phiếu đang mở.
        if (activeRequest) {
          throw new ConflictException(
            'Tài sản đang có một yêu cầu sửa chữa chưa hoàn tất.',
          );
        }

        // Phiếu thu hồi chưa xong có thể thay đổi người giữ hoặc vị trí tài sản.
        const [activeRecall] = await tx
          .select({ id: schema.assetRecallRequests.id })
          .from(schema.assetRecallRequests)
          .where(
            and(
              eq(schema.assetRecallRequests.assetId, dto.assetId),
              sql`${schema.assetRecallRequests.status} <> 'completed'`,
            ),
          );

        // Chờ thu hồi kết thúc để hai quy trình không cùng xử lý một tài sản.
        if (activeRecall) {
          throw new ConflictException(
            'Tài sản đang có phiếu thu hồi chưa hoàn tất.',
          );
        }

        const [request] = await tx
          .insert(schema.repairRequests)
          .values({
            assetId: dto.assetId,
            reporterId: actor.id,
            departmentId: actor.departmentId,
            originalLocation: asset.currentLocation, // Vị trí cần khôi phục khi nghiệm thu.
            reportDate: new Date().toISOString().slice(0, 10),
            issueDescription: dto.issueDescription,
            status: 'draft',
          })
          .returning();

        if (files.length > 0) {
          await tx.insert(schema.attachments).values(
            files.map((file) => ({
              entityType: 'repair_request',
              entityId: request.id,
              fileName: file.originalname,
              url: `/uploads/repair-requests/${file.filename}`,
              mimeType: file.mimetype,
              size: file.size,
              uploadedByEmployeeId: actor.id,
            })),
          );
        }

        await this.audit.log(tx, {
          requestType: 'repair',
          requestId: request.id,
          actionType: 'repair.draft_created',
          approvedBy: actor.id,
          approverRole: actor.roleName,
          status: 'pending',
          previousStatus: 'draft',
          newStatus: 'draft',
          metadata: { attachmentCount: files.length },
        });

        return new RepairRequest(request);
      });
    } catch (error) {
      await removeUploadedFiles(files);
      throw error;
    }
  }

  async updateMine(
    id: string,
    dto: UpdateMyRepairRequestDto,
    actor: AuthenticatedEmployee,
  ) {
    // Mô tả và sự kiện chỉnh sửa phải được lưu hoặc hoàn tác cùng nhau.
    await this.db.transaction(async (tx) => {
      // Khóa trước khi đọc để lần sửa này không chen vào lúc một người khác gửi phiếu.
      const request = await loadLockedRequest(tx, id, [
        'draft',
        'revision_required',
      ]);

      assertOwner(request, actor);

      await tx
        .update(schema.repairRequests)
        .set({
          issueDescription: dto.issueDescription.trim(),
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(schema.repairRequests.id, id));

      await logAction(this.audit, tx, request, actor, {
        actionType: 'repair.draft_updated',
        result: 'pending',
      });
    });

    // Đọc lại sau khi lưu để trả mô tả, timeline và thao tác đang có hiệu lực.
    return findOneForActor(this.audit, this.db, id, actor);
  }

  async submit(id: string, actor: AuthenticatedEmployee) {
    await this.db.transaction(async (tx) => {
      // Khóa trước khi đọc trạng thái để hai lần cùng lúc gửi không tạo hai lượt duyệt.
      const request = await loadLockedRequest(tx, id, [
        'draft',
        'revision_required',
      ]);

      assertOwner(request, actor);

      if (!request.issueDescription.trim()) {
        throw new BadRequestException('Vui lòng mô tả tình trạng tài sản.');
      }

      // Tài sản có thể đã đổi người giữ sau lúc tạo nháp, nên kiểm tra lại sau khi khóa.
      await lockAsset(tx, request.assetId);
      await requireOwnedItAsset(tx, request.assetId, actor.id);

      const now = new Date();
      // Chỉ lần gửi lại mới mở phiên bản duyệt mới để đối chiếu với bản đã bị trả.
      const revision =
        request.status === 'revision_required'
          ? request.currentRevision + 1
          : request.currentRevision;

      // Gửi về bước đầu và xóa quyết định cũ để phiên bản này được duyệt lại đầy đủ.
      await tx
        .update(schema.repairRequests)
        .set({
          status: 'pending_department_head',
          currentRevision: revision,
          departmentHeadDecision: 'pending',
          departmentHeadDecidedBy: null,
          departmentHeadDecidedAt: null,
          departmentHeadNote: null,
          itHeadDecision: 'pending',
          itHeadDecidedBy: null,
          itHeadDecidedAt: null,
          itHeadNote: null,
          employeeHandoverDecision: 'pending',
          employeeHandoverDecidedAt: null,
          employeeHandoverNote: null,
          itHandoverDecision: 'pending',
          itHandoverDecidedBy: null,
          itHandoverDecidedAt: null,
          itHandoverNote: null,
          submittedAt: now,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.repairRequests.id, id));

      await logAction(this.audit, tx, request, actor, {
        actionType: 'repair.submitted',
        result: 'pending',
        newStatus: 'pending_department_head',
        reason: undefined,
        revision: revision,
      });
    });

    // Client cần trạng thái chờ duyệt và danh sách thao tác mới sau khi gửi.
    return findOneForActor(this.audit, this.db, id, actor);
  }

  async decideDepartment(
    id: string,
    dto: RepairDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (tx) => {
      // Khóa rồi kiểm tra đúng bước để hai quyết định đến cùng lúc không ghi đè nhau.
      const request = await loadLockedRequest(tx, id, [
        'pending_department_head',
      ]);

      // Kiểm tra cả chức vụ lẫn bộ phận ghi trên phiếu.
      if (
        !actor.isDepartmentHead ||
        actor.departmentId !== request.departmentId
      ) {
        throw new ForbiddenException(
          'Bạn không được duyệt phiếu của bộ phận khác.',
        );
      }

      const now = new Date();
      // IT chỉ nhận phiếu đã qua bước duyệt của bộ phận gửi.
      const status = dto.approved ? 'pending_it_head' : 'revision_required';

      await tx
        .update(schema.repairRequests)
        .set({
          status,
          departmentHeadDecision: dto.approved ? 'confirmed' : 'rejected',
          departmentHeadDecidedBy: actor.id,
          departmentHeadDecidedAt: now,
          departmentHeadNote: dto.note?.trim() || null,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.repairRequests.id, id));
      await logAction(this.audit, tx, request, actor, {
        actionType: 'repair.department_decision',
        result: dto.approved ? 'approved' : 'rejected',
        newStatus: status,
        reason: dto.note,
      });
    });

    return findOneForActor(this.audit, this.db, id, actor);
  }

  async decideIt(
    id: string,
    dto: RepairDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    assertItHead(actor);
    await this.db.transaction(async (tx) => {
      const request = await loadLockedRequest(tx, id, ['pending_it_head']);
      const now = new Date();
      // Duyệt phiếu chỉ mở bước bàn giao. Tài sản vẫn chưa chuyển vào kho.
      const status = dto.approved
        ? 'pending_handover_confirmations'
        : 'revision_required';

      await tx
        .update(schema.repairRequests)
        .set({
          status,
          itHeadDecision: dto.approved ? 'confirmed' : 'rejected',
          itHeadDecidedBy: actor.id,
          itHeadDecidedAt: now,
          itHeadNote: dto.note?.trim() || null,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.repairRequests.id, id));
      await logAction(this.audit, tx, request, actor, {
        actionType: 'repair.it_decision',
        result: dto.approved ? 'approved' : 'rejected',
        newStatus: status,
        reason: dto.note,
      });
    });

    return findOneForActor(this.audit, this.db, id, actor);
  }

  async decideHandover(
    id: string,
    dto: RepairHandoverDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (tx) => {
      const request = await loadLockedRequest(tx, id, [
        'pending_handover_confirmations',
      ]);

      const side = handoverSide(request, actor);
      const now = new Date();
      const decision = dto.confirmed ? 'confirmed' : 'rejected';
      const note = dto.note?.trim() || null;
      // Một bên từ chối là đủ để trả phiếu về bước chỉnh sửa.
      const status = dto.confirmed ? request.status : 'revision_required';
      const [updated] = await tx
        .update(schema.repairRequests)
        .set({
          status,
          ...(side === 'employee'
            ? {
                employeeHandoverDecision: decision,
                employeeHandoverDecidedAt: now,
                employeeHandoverNote: note,
              }
            : {
                itHandoverDecision: decision,
                itHandoverDecidedBy: actor.id,
                itHandoverDecidedAt: now,
                itHandoverNote: note,
              }),
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();

      await logAction(this.audit, tx, request, actor, {
        actionType: `repair.${side}_handover_${decision}`,
        result: dto.confirmed ? 'approved' : 'rejected',
        newStatus: status,
        reason: dto.confirmed ? undefined : dto.note,
      });

      // Bên xác nhận sau cùng kích hoạt chuyển kho trong cùng giao dịch.
      if (
        dto.confirmed &&
        updated.employeeHandoverDecision === 'confirmed' &&
        updated.itHandoverDecision === 'confirmed'
      ) {
        await receiveForRepair(this.audit, tx, updated, actor, now);
      }
    });

    return findOneForActor(this.audit, this.db, id, actor);
  }
}
