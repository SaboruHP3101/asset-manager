import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RepairRequest } from './entities/repair-request.entity.js';
import {
  CreateMyRepairRequestDto,
  UpdateMyRepairRequestDto,
} from './dto/create-my-repair-request.dto.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  AssignRepairDto,
  CompleteRepairDto,
  ConfirmRepairDto,
  RepairDecisionDto,
  RepairHandoverDecisionDto,
} from './dto/repair-workflow.dto.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';

type Database = NodePgDatabase<typeof schema>;
type RepairRecord = typeof schema.repairRequests.$inferSelect;

@Injectable()
export class RepairRequestsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly audit: RequestAuditService,
  ) {}

  // Tạo yêu cầu pending và lưu thông tin ảnh, video đi kèm
  async createMine(
    actor: AuthenticatedEmployee,
    dto: CreateMyRepairRequestDto,
    files: Express.Multer.File[],
  ) {
    const [asset] = await this.db
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

    if (!asset || asset.managementOwner !== 'it') {
      throw new NotFoundException(
        'Chỉ có thể sửa chữa thiết bị điện tử đang được giao cho bạn.',
      );
    }

    // Mỗi tài sản chỉ có một luồng sửa chữa đang hoạt động để timeline và trạng
    // thái tài sản không bị phân nhánh thành nhiều yêu cầu song song.
    const [activeRequest] = await this.db
      .select({ id: schema.repairRequests.id })
      .from(schema.repairRequests)
      .where(
        and(
          eq(schema.repairRequests.assetId, dto.assetId),
          notInArray(schema.repairRequests.status, ['closed', 'cancelled']),
        ),
      );

    if (activeRequest) {
      throw new ConflictException(
        'Tài sản đang có một yêu cầu sửa chữa chưa hoàn tất.',
      );
    }


    const [activeRecall] = await this.db
      .select({ id: schema.assetRecallRequests.id })
      .from(schema.assetRecallRequests)
      .where(
        and(
          eq(schema.assetRecallRequests.assetId, dto.assetId),
          sql`${schema.assetRecallRequests.status} <> 'completed'`,
        ),
      );

    if (activeRecall) {
      throw new ConflictException('Tài sản đang có phiếu thu hồi chưa hoàn tất.');
    }

    return this.db.transaction(async (tx) => {
      const [request] = await tx
        .insert(schema.repairRequests)
        .values({
          assetId: dto.assetId,
          reporterId: actor.id,
          departmentId: actor.departmentId,
          originalLocation: asset.currentLocation,
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

      await this.audit.log(tx as unknown as NodePgDatabase<typeof schema>, {
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
  }

  async updateMine(
    id: string,
    dto: UpdateMyRepairRequestDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireStatus(tx, id, [
        'draft',
        'revision_required',
      ]);

      this.assertOwner(request, actor);
      await tx
        .update(schema.repairRequests)
        .set({
          issueDescription: dto.issueDescription.trim(),
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(schema.repairRequests.id, id));
      await this.logAction(tx, request, actor, 'repair.draft_updated', 'pending');
    });

    return this.findOneForActor(id, actor);
  }

  async submit(id: string, actor: AuthenticatedEmployee) {
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireStatus(tx, id, [
        'draft',
        'revision_required',
      ]);

      this.assertOwner(request, actor);

      if (!request.issueDescription.trim()) {
        throw new BadRequestException('Vui lòng mô tả tình trạng tài sản.');
      }

      await this.lockAsset(tx, request.assetId);
      await this.requireOwnedItAsset(tx, request.assetId, actor.id);
      const now = new Date();
      const revision =
        request.status === 'revision_required'
          ? request.currentRevision + 1
          : request.currentRevision;

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
      await this.logAction(
        tx,
        request,
        actor,
        'repair.submitted',
        'pending',
        'pending_department_head',
        undefined,
        revision,
      );
    });

    return this.findOneForActor(id, actor);
  }

  async findQueue(actor: AuthenticatedEmployee) {
    const conditions = [];

    if (actor.isDepartmentHead) {
      conditions.push(
        and(
          eq(schema.repairRequests.status, 'pending_department_head'),
          eq(schema.repairRequests.departmentId, actor.departmentId),
        )!,
      );
    }

    if (this.isItHead(actor)) {
      conditions.push(eq(schema.repairRequests.status, 'pending_it_head'));
      conditions.push(
        and(
          eq(schema.repairRequests.status, 'pending_handover_confirmations'),
          eq(schema.repairRequests.itHandoverDecision, 'pending'),
        )!,
      );
      conditions.push(eq(schema.repairRequests.status, 'in_progress'));
    } else if (actor.departmentName === 'IT') {
      conditions.push(
        and(
          eq(schema.repairRequests.status, 'in_progress'),
          eq(schema.repairRequests.assignedTo, actor.id),
        )!,
      );
    }

    conditions.push(
      and(
        eq(schema.repairRequests.reporterId, actor.id),
        or(
          and(
            eq(schema.repairRequests.status, 'pending_handover_confirmations'),
            eq(schema.repairRequests.employeeHandoverDecision, 'pending'),
          ),
          eq(schema.repairRequests.status, 'ready_for_return'),
        ),
      )!,
    );

    return this.findSummaries(or(...conditions)!);
  }

  async findItAssignees(actor: AuthenticatedEmployee) {
    this.assertItHead(actor);

    return this.db
      .select({
        id: schema.employees.id,
        name: schema.employees.fullName,
        email: schema.employees.email,
      })
      .from(schema.employees)
      .innerJoin(
        schema.departments,
        eq(schema.employees.departmentId, schema.departments.id),
      )
      .where(
        and(
          eq(schema.departments.name, 'IT'),
          eq(schema.employees.isActive, true),
        ),
      )
      .orderBy(asc(schema.employees.fullName));
  }

  async findOneForActor(id: string, actor: AuthenticatedEmployee) {
    const request = await this.requireStatus(this.db, id);

    if (!this.canView(request, actor)) {
      throw new ForbiddenException('Bạn không được xem phiếu sửa chữa này.');
    }

    const [asset, trail] = await Promise.all([
      this.loadAsset(this.db, request.assetId),
      this.audit.findTrail('repair', id),
    ]);

    return {
      ...request,
      asset,
      timeline: trail,
      allowedActions: this.allowedActions(request, actor),
    };
  }

  async decideDepartment(
    id: string,
    dto: RepairDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireStatus(tx, id, [
        'pending_department_head',
      ]);

      if (!actor.isDepartmentHead || actor.departmentId !== request.departmentId) {
        throw new ForbiddenException('Bạn không được duyệt phiếu của bộ phận khác.');
      }

      const now = new Date();
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
      await this.logAction(
        tx,
        request,
        actor,
        'repair.department_decision',
        dto.approved ? 'approved' : 'rejected',
        status,
        dto.note,
      );
    });

    return this.findOneForActor(id, actor);
  }

  async decideIt(
    id: string,
    dto: RepairDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    this.assertItHead(actor);
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireStatus(tx, id, ['pending_it_head']);
      const now = new Date();
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
      await this.logAction(
        tx,
        request,
        actor,
        'repair.it_decision',
        dto.approved ? 'approved' : 'rejected',
        status,
        dto.note,
      );
    });

    return this.findOneForActor(id, actor);
  }

  async decideHandover(
    id: string,
    dto: RepairHandoverDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireStatus(tx, id, [
        'pending_handover_confirmations',
      ]);
      const side = this.handoverSide(request, actor);
      const now = new Date();

      if (!dto.confirmed) {
        await tx
          .update(schema.repairRequests)
          .set({
            status: 'revision_required',
            ...(side === 'employee'
              ? {
                  employeeHandoverDecision: 'rejected' as const,
                  employeeHandoverDecidedAt: now,
                  employeeHandoverNote: dto.note?.trim() || null,
                }
              : {
                  itHandoverDecision: 'rejected' as const,
                  itHandoverDecidedBy: actor.id,
                  itHandoverDecidedAt: now,
                  itHandoverNote: dto.note?.trim() || null,
                }),
            updatedAt: now,
            updatedBy: actor.id,
          })
          .where(eq(schema.repairRequests.id, id));
        await this.logAction(
          tx,
          request,
          actor,
          `repair.${side}_handover_rejected`,
          'rejected',
          'revision_required',
          dto.note,
        );

        return;
      }

      const [updated] = await tx
        .update(schema.repairRequests)
        .set({
          ...(side === 'employee'
            ? {
                employeeHandoverDecision: 'confirmed' as const,
                employeeHandoverDecidedAt: now,
                employeeHandoverNote: dto.note?.trim() || null,
              }
            : {
                itHandoverDecision: 'confirmed' as const,
                itHandoverDecidedBy: actor.id,
                itHandoverDecidedAt: now,
                itHandoverNote: dto.note?.trim() || null,
              }),
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();

      await this.logAction(
        tx,
        request,
        actor,
        `repair.${side}_handover_confirmed`,
        'approved',
      );

      if (
        updated.employeeHandoverDecision === 'confirmed' &&
        updated.itHandoverDecision === 'confirmed'
      ) {
        await this.receiveForRepair(tx, updated, actor, now);
      }
    });

    return this.findOneForActor(id, actor);
  }

  /**
   * Trả yêu cầu gần nhất của một tài sản cùng audit trail để mobile quyết định
   * hiển thị nút tạo mới hay màn hình tiến trình. Chỉ chủ tài sản được phép xem.
   */
  async findMyLatestByAsset(
    actor: AuthenticatedEmployee,
    assetId: string,
  ) {
    const [request] = await this.db
      .select()
      .from(schema.repairRequests)
      .where(
        and(
          eq(schema.repairRequests.assetId, assetId),
          eq(schema.repairRequests.reporterId, actor.id),
        ),
      )
      .orderBy(desc(schema.repairRequests.createdAt))
      .limit(1);

    if (!request) {
      await this.requireOwnedItAsset(this.db, assetId, actor.id);

      return null;
    }

    const detail = await this.findOneForActor(request.id, actor);

    return { request: detail, timeline: detail.timeline };
  }

  /** Lấy toàn bộ yêu cầu của nhân viên kèm thông tin tài sản để dựng list card. */
  async findMine(employeeId: string) {
    const requests = await this.db
      .select({
        id: schema.repairRequests.id,
        assetId: schema.repairRequests.assetId,
        assetCode: schema.assets.assetCode,
        assetName: schema.assetCategories.name,
        status: schema.repairRequests.status,
        issueDescription: schema.repairRequests.issueDescription,
        reportDate: schema.repairRequests.reportDate,
        createdAt: schema.repairRequests.createdAt,
      })
      .from(schema.repairRequests)
      .innerJoin(
        schema.assets,
        eq(schema.repairRequests.assetId, schema.assets.id),
      )
      .innerJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .where(eq(schema.repairRequests.reporterId, employeeId))
      .orderBy(desc(schema.repairRequests.createdAt));

    if (requests.length === 0) return [];

    const attachments = await this.db
      .select({
        entityId: schema.attachments.entityId,
        url: schema.attachments.url,
      })
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.entityType, 'asset'),
          inArray(
            schema.attachments.entityId,
            requests.map((request) => request.assetId),
          ),
        ),
      )
      .orderBy(asc(schema.attachments.createdAt));
    const images = new Map<string, string>();

    for (const attachment of attachments) {
      if (!images.has(attachment.entityId)) {
        images.set(attachment.entityId, attachment.url);
      }
    }

    return requests.map((request) => ({
      ...request,
      imageUrl: images.get(request.assetId) ?? null,
    }));
  }

  /** Trả timeline đúng request được chọn và kiểm tra request thuộc nhân viên. */
  async findMyProgress(employeeId: string, requestId: string) {
    const [request] = await this.db
      .select()
      .from(schema.repairRequests)
      .where(
        and(
          eq(schema.repairRequests.id, requestId),
          eq(schema.repairRequests.reporterId, employeeId),
        ),
      );

    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu sửa chữa.');
    }

    return {
      request: new RepairRequest(request),
      timeline: await this.audit.findTrail('repair', request.id),
    };
  }

  /** Đọc và khóa luồng bằng trạng thái mong đợi trước mỗi hành động nghiệp vụ. */
  private async requireStatus(
    db: NodePgDatabase<typeof schema>,
    id: string,
    expected?: (typeof schema.repairStatusEnum.enumValues)[number][],
  ) {
    const [request] = await db
      .select()
      .from(schema.repairRequests)
      .where(eq(schema.repairRequests.id, id));

    if (!request) {
      throw new NotFoundException(
        `Không tìm thấy yêu cầu sửa chữa có ID ${id}`,
      );
    }

    if (expected && !expected.includes(request.status)) {
      throw new BadRequestException(
        `Không thể thực hiện ở trạng thái ${request.status}.`,
      );
    }

    return request;
  }

  /** Phân công kỹ thuật viên khi yêu cầu đã sẵn sàng xử lý. */
  async assign(id: string, dto: AssignRepairDto, actor: AuthenticatedEmployee) {
    this.assertItHead(actor);

    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;

      await this.lockRequest(db, id);
      await this.requireStatus(db, id, ['in_progress']);

      const [assignee] = await db
        .select({
          id: schema.employees.id,
          isActive: schema.employees.isActive,
          departmentName: schema.departments.name,
        })
        .from(schema.employees)
        .innerJoin(
          schema.departments,
          eq(schema.employees.departmentId, schema.departments.id),
        )
        .where(eq(schema.employees.id, dto.assignedTo));

      if (!assignee || !assignee.isActive || assignee.departmentName !== 'IT') {
        throw new BadRequestException('Chỉ có thể phân công nhân viên IT đang hoạt động.');
      }

      const [request] = await db
        .update(schema.repairRequests)
        .set({
          assignedTo: dto.assignedTo,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();

      await this.audit.log(db, {
        requestType: 'repair',
        requestId: id,
        actionType: 'assigned',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
        metadata: { assignedTo: dto.assignedTo },
      });

      return new RepairRequest(request);
    });
  }

  /** Ghi kết quả sửa chữa và chờ người báo hỏng nghiệm thu. */
  async complete(
    id: string,
    dto: CompleteRepairDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;

      await this.lockRequest(db, id);
      const current = await this.requireStatus(db, id, ['in_progress']);

      if (
        (!current.assignedTo && !this.isItHead(actor)) ||
        (current.assignedTo !== null &&
          current.assignedTo !== actor.id &&
          !this.isItHead(actor))
      ) {
        throw new ForbiddenException(
          'Chỉ kỹ thuật viên được phân công hoặc Trưởng IT được hoàn tất.',
        );
      }

      const [request] = await db
        .update(schema.repairRequests)
        .set({
          status: 'ready_for_return',
          completedAt: new Date(),
          resultNotes: dto.resultNotes,
          repairCost: dto.actualCost,
          updatedAt: new Date(),
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();

      await this.audit.log(db, {
        requestType: 'repair',
        requestId: id,
        actionType: 'completed',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
        previousStatus: current.status,
        newStatus: 'ready_for_return',
        metadata: { actualCost: dto.actualCost },
      });

      return new RepairRequest(request);
    });
  }

  /**
   * Chấp nhận sẽ đóng yêu cầu. Nếu người dùng từ chối kết quả, yêu cầu quay lại
   * in_progress để IT làm lại; đây là ngoại lệ có chủ đích của luồng sửa chữa.
   */
  async confirmResult(
    id: string,
    dto: ConfirmRepairDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;

      await this.lockRequest(db, id);
      const current = await this.requireStatus(db, id, ['ready_for_return']);

      if (current.reporterId !== actor.id) {
        throw new BadRequestException(
          'Chỉ người báo hỏng mới được nghiệm thu kết quả',
        );
      }

      const now = new Date();
      const status = dto.accepted ? 'closed' : 'in_progress';

      await this.lockAsset(db, current.assetId);
      const warehouse = await this.requireItWarehouse(db);
      const asset = await this.loadAsset(db, current.assetId);

      if (
        asset.currentWarehouseId !== warehouse.id ||
        asset.currentUserId !== null ||
        asset.status !== 'repairing'
      ) {
        throw new ConflictException('Tài sản không còn ở kho IT.');
      }

      if (dto.accepted) {
        await db
          .update(schema.assets)
          .set({
            status: 'active',
            currentUserId: current.reporterId,
            currentManagingDepartmentId: current.departmentId,
            currentWarehouseId: null,
            currentLocation: current.originalLocation,
            updatedAt: now,
            updatedBy: actor.id,
          })
          .where(eq(schema.assets.id, asset.id));
        await db.insert(schema.assetHandoverHistory).values({
          assetId: asset.id,
          handoverType: 'repair_returned',
          handoverFromDepartmentId: warehouse.managingDepartmentId,
          handoverFromWarehouseId: warehouse.id,
          receivedByEmployeeId: current.reporterId,
          receivedByDepartmentId: current.departmentId,
          handoverDate: now.toISOString().slice(0, 10),
          status: 'completed',
          note: `Repair request ${current.id}`,
          createdBy: actor.id,
          updatedBy: actor.id,
        });
      }

      const [request] = await db
        .update(schema.repairRequests)
        .set({
          status,
          confirmedBy: actor.id,
          confirmedAt: now,
          confirmationStatus: dto.accepted ? 'approved' : 'rejected',
          closedAt: dto.accepted ? now : null,
          completedAt: dto.accepted ? current.completedAt : null,
          resultNotes: dto.accepted ? current.resultNotes : null,
          repairCost: dto.accepted ? current.repairCost : null,
          updatedAt: now,
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();

      await this.audit.log(db, {
        requestType: 'repair',
        requestId: id,
        actionType: dto.accepted ? 'confirmed' : 'rejected',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: dto.accepted ? 'approved' : 'rejected',
        previousStatus: current.status,
        newStatus: status,
        notes: dto.note,
      });

      return new RepairRequest(request);
    });
  }

  private async receiveForRepair(
    db: Database,
    request: RepairRecord,
    actor: AuthenticatedEmployee,
    now: Date,
  ) {
    await this.lockAsset(db, request.assetId);
    const asset = await this.requireOwnedItAsset(
      db,
      request.assetId,
      request.reporterId,
    );
    const warehouse = await this.requireItWarehouse(db);

    // Custody chỉ thay đổi sau khi cả hai bên xác nhận bàn giao thực tế.
    await db
      .update(schema.assets)
      .set({
        status: 'repairing',
        currentUserId: null,
        currentManagingDepartmentId: warehouse.managingDepartmentId,
        currentWarehouseId: warehouse.id,
        currentLocation: warehouse.location,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assets.id, asset.id));
    await db.insert(schema.assetHandoverHistory).values({
      assetId: asset.id,
      handoverType: 'repair_to_it_warehouse',
      handoverFromEmployeeId: request.reporterId,
      handoverFromDepartmentId: request.departmentId,
      receivedByDepartmentId: warehouse.managingDepartmentId,
      receivedByWarehouseId: warehouse.id,
      handoverDate: now.toISOString().slice(0, 10),
      status: 'completed',
      note: `Repair request ${request.id}`,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await db
      .update(schema.repairRequests)
      .set({ status: 'in_progress', updatedAt: now, updatedBy: actor.id })
      .where(eq(schema.repairRequests.id, request.id));
    await this.logAction(
      db,
      request,
      actor,
      'repair.received',
      'approved',
      'in_progress',
    );
  }

  private async findSummaries(condition: SQL<unknown>) {
    return this.db
      .select({
        id: schema.repairRequests.id,
        assetId: schema.repairRequests.assetId,
        assetCode: schema.assets.assetCode,
        assetName: schema.assets.name,
        status: schema.repairRequests.status,
        issueDescription: schema.repairRequests.issueDescription,
        reportDate: schema.repairRequests.reportDate,
        createdAt: schema.repairRequests.createdAt,
      })
      .from(schema.repairRequests)
      .innerJoin(
        schema.assets,
        eq(schema.repairRequests.assetId, schema.assets.id),
      )
      .where(condition)
      .orderBy(desc(schema.repairRequests.createdAt));
  }

  private async loadAsset(db: Database, id: string) {
    const [asset] = await db
      .select({
        id: schema.assets.id,
        assetCode: schema.assets.assetCode,
        name: schema.assets.name,
        status: schema.assets.status,
        currentLocation: schema.assets.currentLocation,
        currentUserId: schema.assets.currentUserId,
        currentWarehouseId: schema.assets.currentWarehouseId,
        managementOwner: schema.assetCategories.managementOwner,
        category: schema.assetCategories.name,
      })
      .from(schema.assets)
      .innerJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .where(eq(schema.assets.id, id));

    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');

    return asset;
  }

  private async requireOwnedItAsset(
    db: Database,
    assetId: string,
    employeeId: string,
  ) {
    const asset = await this.loadAsset(db, assetId);

    if (asset.currentUserId !== employeeId || asset.managementOwner !== 'it') {
      throw new BadRequestException(
        'Chỉ có thể sửa chữa thiết bị điện tử đang được giao cho bạn.',
      );
    }

    return asset;
  }

  private async requireItWarehouse(db: Database) {
    const [warehouse] = await db
      .select()
      .from(schema.warehouses)
      .where(
        and(
          eq(schema.warehouses.code, 'IT_WAREHOUSE'),
          eq(schema.warehouses.isActive, true),
        ),
      );

    if (!warehouse) throw new NotFoundException('Không tìm thấy kho IT.');

    return warehouse;
  }

  private allowedActions(
    request: RepairRecord,
    actor: AuthenticatedEmployee,
  ): WorkflowAction[] {
    const actions: WorkflowAction[] = [];

    if (
      request.reporterId === actor.id &&
      ['draft', 'revision_required'].includes(request.status)
    ) {
      actions.push(WORKFLOW_ACTIONS.repairUpdate, WORKFLOW_ACTIONS.repairSubmit);
    }

    if (
      request.status === 'pending_department_head' &&
      actor.isDepartmentHead &&
      actor.departmentId === request.departmentId
    ) {
      actions.push(WORKFLOW_ACTIONS.repairApproveDepartment);
    }

    if (request.status === 'pending_it_head' && this.isItHead(actor)) {
      actions.push(WORKFLOW_ACTIONS.repairApproveIt);
    }

    if (
      request.status === 'pending_handover_confirmations' &&
      ((request.reporterId === actor.id &&
        request.employeeHandoverDecision === 'pending') ||
        (this.isItHead(actor) && request.itHandoverDecision === 'pending'))
    ) {
      actions.push(WORKFLOW_ACTIONS.repairConfirmHandover);
    }

    if (request.status === 'in_progress' && this.isItHead(actor)) {
      actions.push(WORKFLOW_ACTIONS.repairAssign, WORKFLOW_ACTIONS.repairComplete);
    } else if (
      request.status === 'in_progress' &&
      request.assignedTo === actor.id
    ) {
      actions.push(WORKFLOW_ACTIONS.repairComplete);
    }

    if (request.status === 'ready_for_return' && request.reporterId === actor.id) {
      actions.push(WORKFLOW_ACTIONS.repairConfirmResult);
    }

    return actions;
  }

  private canView(request: RepairRecord, actor: AuthenticatedEmployee) {
    return (
      request.reporterId === actor.id ||
      (actor.isDepartmentHead && actor.departmentId === request.departmentId) ||
      actor.departmentName === 'IT'
    );
  }

  private assertOwner(request: RepairRecord, actor: AuthenticatedEmployee) {
    if (request.reporterId !== actor.id) {
      throw new ForbiddenException('Chỉ người tạo mới được sửa phiếu.');
    }
  }

  private assertItHead(actor: AuthenticatedEmployee) {
    if (!this.isItHead(actor)) {
      throw new ForbiddenException('Chỉ Trưởng IT được thực hiện thao tác này.');
    }
  }

  private isItHead(actor: AuthenticatedEmployee) {
    return actor.isDepartmentHead && actor.departmentName === 'IT';
  }

  private handoverSide(
    request: RepairRecord,
    actor: AuthenticatedEmployee,
  ): 'employee' | 'it' {
    if (
      request.reporterId === actor.id &&
      request.employeeHandoverDecision === 'pending'
    ) {
      return 'employee';
    }

    if (this.isItHead(actor) && request.itHandoverDecision === 'pending') {
      return 'it';
    }

    throw new ForbiddenException('Bạn không có xác nhận bàn giao đang chờ.');
  }

  private lockAsset(db: Database, id: string) {
    return db.execute(sql`select id from assets where id = ${id} for update`);
  }

  private lockRequest(db: Database, id: string) {
    return db.execute(
      sql`select id from repair_requests where id = ${id} for update`,
    );
  }

  private logAction(
    db: Database,
    request: RepairRecord,
    actor: AuthenticatedEmployee,
    actionType: string,
    status: 'approved' | 'rejected' | 'pending',
    newStatus = request.status,
    reason?: string,
    revision = request.currentRevision,
  ) {
    return this.audit.log(db, {
      requestType: 'repair',
      requestId: request.id,
      workflowRevision: revision,
      actionType,
      approvedBy: actor.id,
      approverRole: actor.roleName,
      actorDepartmentId: actor.departmentId,
      actorIsDepartmentHead: actor.isDepartmentHead,
      status,
      previousStatus: request.status,
      newStatus,
      reason,
      notes: reason,
    });
  }

}
