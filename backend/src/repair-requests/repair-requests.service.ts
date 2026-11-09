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

  async createMine(
    actor: AuthenticatedEmployee,
    dto: CreateMyRepairRequestDto,
    files: Express.Multer.File[],
  ) {
    return this.db.transaction(async (tx) => {
      // Luồng thu hồi cũng khóa dòng tài sản trước khi kiểm tra phiếu đang mở.
      await this.lockAsset(tx, dto.assetId);
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
  }

  /** Chỉ người tạo được sửa mô tả khi phiếu còn nháp hoặc đã bị trả về. */
  async updateMine(
    id: string,
    dto: UpdateMyRepairRequestDto,
    actor: AuthenticatedEmployee,
  ) {
    // Mô tả và sự kiện chỉnh sửa phải được lưu hoặc hoàn tác cùng nhau.
    await this.db.transaction(async (tx) => {
      // Khóa trước khi đọc để lần sửa này không chen vào lúc một người khác gửi phiếu.
      const request = await this.loadLockedRequest(tx, id, [
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

      await this.logAction(
        tx,
        request,
        actor,
        'repair.draft_updated',
        'pending',
      );
    });

    // Đọc lại sau khi lưu để trả mô tả, timeline và thao tác đang có hiệu lực.
    return this.findOneForActor(id, actor);
  }

  /** Gửi bản nháp hoặc bản sửa lại cho trưởng bộ phận duyệt. */
  async submit(id: string, actor: AuthenticatedEmployee) {
    await this.db.transaction(async (tx) => {
      // Khóa trước khi đọc trạng thái để hai lần cùng lúc gửi không tạo hai lượt duyệt.
      const request = await this.loadLockedRequest(tx, id, [
        'draft',
        'revision_required',
      ]);

      this.assertOwner(request, actor);

      if (!request.issueDescription.trim()) {
        throw new BadRequestException('Vui lòng mô tả tình trạng tài sản.');
      }

      // Tài sản có thể đã đổi người giữ sau lúc tạo nháp, nên kiểm tra lại sau khi khóa.
      await this.lockAsset(tx, request.assetId);
      await this.requireOwnedItAsset(tx, request.assetId, actor.id);

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

    // Client cần trạng thái chờ duyệt và danh sách thao tác mới sau khi gửi.
    return this.findOneForActor(id, actor);
  }

  /** Tìm những phiếu cần làm cho tài khoản hiện tại. */
  async findQueue(actor: AuthenticatedEmployee) {
    const conditions = [];

    // Trưởng bộ phận chỉ duyệt ở bước đầu và trong bộ phận mình.
    if (actor.isDepartmentHead) {
      conditions.push(
        and(
          eq(schema.repairRequests.status, 'pending_department_head'),
          eq(schema.repairRequests.departmentId, actor.departmentId),
        )!,
      );
    }

    // Trưởng IT xử lý cả duyệt, bàn giao phía IT và phân công hoặc hoàn tất sửa chữa.
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
      // Kỹ thuật viên chỉ nhận việc đang sửa đã giao cho mình.
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

  /** Cung cấp danh sách để trưởng IT chọn người nhận việc. */
  async findItAssignees(actor: AuthenticatedEmployee) {
    this.assertItHead(actor);

    // Chỉ hiện nhân viên IT còn hoạt động, xếp theo tên để dễ tìm trong danh sách.
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

  /** Trả chi tiết và các thao tác phù hợp với tài khoản đang xem phiếu. */
  async findOneForActor(id: string, actor: AuthenticatedEmployee) {
    const request = await this.requireStatus(this.db, id);

    // Kiểm tra quyền trước khi đọc thông tin tài sản và nhật ký đi kèm.
    if (!this.canView(request, actor)) {
      throw new ForbiddenException('Bạn không được xem phiếu sửa chữa này.');
    }

    // Hai truy vấn độc lập nên có thể chạy song song.
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

  /** Cho trưởng bộ phận chuyển phiếu đến IT hoặc trả người báo chỉnh sửa. */
  async decideDepartment(
    id: string,
    dto: RepairDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (tx) => {
      // Khóa rồi kiểm tra đúng bước để hai quyết định đến cùng lúc không ghi đè nhau.
      const request = await this.loadLockedRequest(tx, id, [
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
      await this.logAction(
        tx,
        request,
        actor,
        'repair.department_decision', // Tách khỏi quyết định của IT trong timeline.
        dto.approved ? 'approved' : 'rejected',
        status,
        dto.note,
      );
    });

    return this.findOneForActor(id, actor);
  }

  /** Cho trưởng IT mở bước bàn giao hoặc yêu cầu người báo sửa phiếu. */
  async decideIt(
    id: string,
    dto: RepairDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    this.assertItHead(actor);
    await this.db.transaction(async (tx) => {
      const request = await this.loadLockedRequest(tx, id, ['pending_it_head']);
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
      await this.logAction(
        tx,
        request,
        actor,
        'repair.it_decision', // Timeline cho biết IT đã quyết định ở bước nào.
        dto.approved ? 'approved' : 'rejected',
        status,
        dto.note,
      );
    });

    return this.findOneForActor(id, actor);
  }

  /** Ghi xác nhận của từng bên và chỉ nhận tài sản khi cả hai bên đồng ý. */
  async decideHandover(
    id: string,
    dto: RepairHandoverDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (tx) => {
      const request = await this.loadLockedRequest(tx, id, [
        'pending_handover_confirmations',
      ]);

      const side = this.handoverSide(request, actor);
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

      await this.logAction(
        tx,
        request,
        actor,
        `repair.${side}_handover_${decision}`,
        dto.confirmed ? 'approved' : 'rejected',
        status,
        dto.confirmed ? undefined : dto.note,
      );

      // Bên xác nhận sau cùng kích hoạt chuyển kho trong cùng giao dịch.
      if (
        dto.confirmed &&
        updated.employeeHandoverDecision === 'confirmed' &&
        updated.itHandoverDecision === 'confirmed'
      ) {
        await this.receiveForRepair(tx, updated, actor, now);
      }
    });

    return this.findOneForActor(id, actor);
  }

  /**
   * Lấy phiếu gần nhất do người gọi báo cho tài sản này để mở màn hình tiến trình.
   * Nếu chưa có phiếu, chỉ trả null khi người gọi đang giữ tài sản IT này.
   */
  async findMyLatestByAsset(actor: AuthenticatedEmployee, assetId: string) {
    const [request] = await this.db
      .select()
      .from(schema.repairRequests)
      .where(
        and(
          eq(schema.repairRequests.assetId, assetId),
          eq(schema.repairRequests.reporterId, actor.id),
        ),
      )
      // Màn hình tài sản chỉ cần phiếu mới nhất của người báo.
      .orderBy(desc(schema.repairRequests.createdAt))
      .limit(1);

    if (!request) {
      // Phân biệt chưa có phiếu với trường hợp tài sản không thuộc phạm vi của người gọi.
      await this.requireOwnedItAsset(this.db, assetId, actor.id);

      return null;
    }

    // Dùng cùng dữ liệu chi tiết và quyền thao tác như khi mở phiếu từ danh sách.
    const detail = await this.findOneForActor(request.id, actor);

    return { request: detail, timeline: detail.timeline };
  }

  /** Lấy danh sách phiếu của người báo cùng thông tin hiển thị trên thẻ tài sản. */
  async findMine(employeeId: string) {
    // Chỉ chọn các cột thẻ cần và xếp phiếu mới lên đầu.
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

    // Bỏ qua truy vấn ảnh khi không có mã tài sản nào để tìm.
    if (requests.length === 0) return [];

    // Lấy ảnh của các tài sản trong một truy vấn để tránh đọc lại theo từng phiếu.
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
    // Tra ảnh theo ID tài sản vì nhiều phiếu có thể thuộc cùng một tài sản.
    const images = new Map<string, string>();

    for (const attachment of attachments) {
      // Kết quả xếp cũ trước, nên giữ ảnh đầu tiên của mỗi tài sản.
      if (!images.has(attachment.entityId)) {
        images.set(attachment.entityId, attachment.url);
      }
    }

    // Giữ phiếu không có ảnh để client vẫn hiển thị được thẻ và ảnh mặc định.
    return requests.map((request) => ({
      ...request,
      imageUrl: images.get(request.assetId) ?? null,
    }));
  }

  /** Trả tiến trình của phiếu cụ thể do chính nhân viên báo hỏng. */
  async findMyProgress(employeeId: string, requestId: string) {
    // Ràng buộc cả ID phiếu lẫn người báo để biết ID không đủ đọc tiến trình.
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
      // Trả cùng lỗi cho ID không tồn tại và ID phiếu của người khác.
      throw new NotFoundException('Không tìm thấy yêu cầu sửa chữa.');
    }

    return {
      request: new RepairRequest(request),
      timeline: await this.audit.findTrail('repair', request.id),
    };
  }

  /** Đọc phiếu và kiểm tra bước hiện tại. Các thao tác ghi phải khóa phiếu trước khi gọi. */
  private async requireStatus(
    db: Database,
    id: string,
    expected?: RepairRecord['status'][],
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

    // Đọc chi tiết có thể bỏ qua danh sách trạng thái. Thao tác ghi chỉ chạy ở bước hợp lệ.
    if (expected && !expected.includes(request.status)) {
      throw new BadRequestException(
        `Không thể thực hiện ở trạng thái ${request.status}.`,
      );
    }

    return request;
  }

  /** Phân công kỹ thuật viên sau khi tài sản đã được nhận để sửa. */
  async assign(id: string, dto: AssignRepairDto, actor: AuthenticatedEmployee) {
    this.assertItHead(actor);

    return this.db.transaction(async (db) => {
      // Chưa bàn giao xong hoặc đã chờ nghiệm thu thì không phân công tại bước này.
      await this.loadLockedRequest(db, id, ['in_progress']);

      // Đọc phòng ban và tình trạng tài khoản từ DB, không dựa vào dữ liệu client gửi.
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

      // Kiểm tra lại vì danh sách chọn trên màn hình có thể đã cũ.
      if (!assignee || !assignee.isActive || assignee.departmentName !== 'IT') {
        throw new BadRequestException(
          'Chỉ có thể phân công nhân viên IT đang hoạt động.',
        );
      }

      // Người được giao trên phiếu là căn cứ cấp quyền hoàn tất cho kỹ thuật viên.
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
        metadata: { assignedTo: dto.assignedTo }, // Phân biệt người giao việc với người nhận việc.
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
    return this.db.transaction(async (db) => {
      const current = await this.loadLockedRequest(db, id, ['in_progress']);

      // Trưởng IT có thể hoàn tất. Nhân viên IT phải là người đang được phân công.
      if (
        !this.isItHead(actor) &&
        (actor.departmentName !== 'IT' || current.assignedTo !== actor.id)
      ) {
        throw new ForbiddenException(
          'Chỉ kỹ thuật viên được phân công hoặc Trưởng IT được hoàn tất.',
        );
      }

      // Lưu kết quả và số tiền của lần này. Phiếu vẫn phải qua nghiệm thu trước khi đóng.
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
        status: 'approved', // Ghi nhận bước IT hoàn tất. Nghiệm thu là một sự kiện riêng.
        previousStatus: current.status,
        newStatus: 'ready_for_return',
        // Giữ số tiền của từng lần để xem lại và điền sẵn nếu tài sản bị trả để sửa tiếp.
        metadata: { actualCost: dto.actualCost },
      });

      return new RepairRequest(request);
    });
  }

  /**
   * Nghiệm thu thành công thì trả tài sản và đóng phiếu.
   * Từ chối thì giữ tài sản ở kho IT để tiếp tục sửa trên cùng phiếu.
   */
  async confirmResult(
    id: string,
    dto: ConfirmRepairDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.db.transaction(async (db) => {
      const current = await this.loadLockedRequest(db, id, ['ready_for_return']);

      // Người báo hỏng là người nhận lại tài sản và quyết định có chấp nhận kết quả.
      if (current.reporterId !== actor.id) {
        throw new BadRequestException(
          'Chỉ người báo hỏng mới được nghiệm thu kết quả',
        );
      }

      const now = new Date();
      const status = dto.accepted ? 'closed' : 'in_progress';

      // Khóa tài sản để không thao tác trả trên dữ liệu vị trí hoặc người giữ đã đổi.
      await this.lockAsset(db, current.assetId);
      const warehouse = await this.requireItWarehouse(db);
      const asset = await this.loadAsset(db, current.assetId);

      // Chỉ xử lý nghiệm thu nếu tài sản vẫn do kho IT giữ và đang trong luồng sửa.
      if (
        asset.currentWarehouseId !== warehouse.id ||
        asset.currentUserId !== null ||
        asset.status !== 'repairing'
      ) {
        throw new ConflictException('Tài sản không còn ở kho IT.');
      }

      // Chỉ khi được nghiệm thu mới chuyển tài sản về người báo và vị trí trước lúc bàn giao.
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
        // Lưu lần trả tài sản để lịch sử vị trí khớp với người giữ hiện tại.
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

      // Phiếu bị trả xóa kết quả chờ nghiệm thu. Số tiền lần sửa vẫn còn trong nhật ký.
      const [request] = await db
        .update(schema.repairRequests)
        .set({
          status,
          confirmedBy: actor.id,
          confirmedAt: now,
          confirmationStatus: dto.accepted ? 'approved' : 'rejected',
          closedAt: dto.accepted ? now : null, // Báo cáo tháng dùng ngày đóng phiếu này.
          completedAt: dto.accepted ? current.completedAt : null,
          resultNotes: dto.accepted ? current.resultNotes : null,
          repairCost: dto.accepted ? current.repairCost : null,
          updatedAt: now,
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();

      // Giữ quyết định và lý do để đọc lại kết quả của từng vòng sửa.
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

  /** Chuyển tài sản vào kho IT trước khi mở bước phân công và sửa chữa. */
  private async receiveForRepair(
    db: Database,
    request: RepairRecord,
    actor: AuthenticatedEmployee,
    now: Date,
  ) {
    // Người giữ có thể đã đổi trong lúc chờ bàn giao, nên kiểm tra lại sau khi khóa tài sản.
    await this.lockAsset(db, request.assetId);
    const asset = await this.requireOwnedItAsset(
      db,
      request.assetId,
      request.reporterId,
    );
    // Kho đang hoạt động cung cấp bộ phận quản lý và vị trí đích.
    const warehouse = await this.requireItWarehouse(db);

    // Sau khi cả hai bên xác nhận, kho IT thay người báo giữ tài sản trong thời gian sửa.
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
    // Lưu điểm đi và điểm đến để đối chiếu lần nhập kho với lần trả tài sản.
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
    // Chỉ đưa phiếu vào hàng chờ sửa khi đã ghi nhận tài sản vào kho.
    await db
      .update(schema.repairRequests)
      .set({ status: 'in_progress', updatedAt: now, updatedBy: actor.id })
      .where(eq(schema.repairRequests.id, request.id));
    // Timeline dùng sự kiện nhận tài sản để phân biệt nhập kho với xác nhận của từng bên.
    await this.logAction(
      db,
      request,
      actor,
      'repair.received',
      'approved',
      'in_progress',
    );
  }

  /** Dùng chung dữ liệu thẻ phiếu, còn hàm gọi cung cấp điều kiện theo quyền. */
  private async findSummaries(condition: SQL<unknown>) {
    return (
      this.db
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
        // Lọc ngay trong DB để hàng chờ chỉ trả phiếu khớp vai trò và bước xử lý.
        .where(condition)
        .orderBy(desc(schema.repairRequests.createdAt))
    );
  }

  /** Đọc cả thông tin hiển thị và dữ liệu kiểm tra quyền giữ tài sản. */
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

    // Dừng các bước sửa hoặc bàn giao nếu không còn tìm thấy tài sản liên quan.
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');

    return asset;
  }

  /** Kiểm tra người giữ hiện tại và phạm vi IT trước khi gửi phiếu hoặc nhập kho. */
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

  /** Dùng mã kho cố định để lấy đúng kho sửa chữa, kể cả khi tên hiển thị thay đổi. */
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

    // Không thể nhận hoặc trả tài sản nếu thiếu kho IT đang hoạt động.
    if (!warehouse) throw new NotFoundException('Không tìm thấy kho IT.');

    return warehouse;
  }

  /** Tính các nút client có thể hiện từ người xem và trạng thái phiếu. */
  private allowedActions(
    request: RepairRecord,
    actor: AuthenticatedEmployee,
  ): WorkflowAction[] {
    const actions: WorkflowAction[] = [];

    // Người báo chỉ sửa hoặc gửi ở bước soạn phiếu.
    if (
      request.reporterId === actor.id &&
      ['draft', 'revision_required'].includes(request.status)
    ) {
      actions.push(
        WORKFLOW_ACTIONS.repairUpdate,
        WORKFLOW_ACTIONS.repairSubmit,
      );
    }

    // Quyền duyệt bước đầu đi theo bộ phận ghi trên phiếu.
    if (
      request.status === 'pending_department_head' &&
      actor.isDepartmentHead &&
      actor.departmentId === request.departmentId
    ) {
      actions.push(WORKFLOW_ACTIONS.repairApproveDepartment);
    }

    // Nút duyệt IT chỉ xuất hiện khi phiếu đã qua bộ phận gửi.
    if (request.status === 'pending_it_head' && this.isItHead(actor)) {
      actions.push(WORKFLOW_ACTIONS.repairApproveIt);
    }

    // Mỗi bên chỉ thấy nút khi phần xác nhận của mình còn chờ.
    if (
      request.status === 'pending_handover_confirmations' &&
      ((request.reporterId === actor.id &&
        request.employeeHandoverDecision === 'pending') ||
        (this.isItHead(actor) && request.itHandoverDecision === 'pending'))
    ) {
      actions.push(WORKFLOW_ACTIONS.repairConfirmHandover);
    }

    // Khi đang sửa, trưởng IT có thể giao việc hoặc hoàn tất. Kỹ thuật viên chỉ hoàn tất phiếu của mình.
    if (request.status === 'in_progress' && this.isItHead(actor)) {
      actions.push(
        WORKFLOW_ACTIONS.repairAssign,
        WORKFLOW_ACTIONS.repairComplete,
      );
    } else if (
      request.status === 'in_progress' &&
      actor.departmentName === 'IT' &&
      request.assignedTo === actor.id
    ) {
      actions.push(WORKFLOW_ACTIONS.repairComplete);
    }

    // Chỉ người báo thấy nút nghiệm thu sau khi IT đã báo hoàn tất.
    if (
      request.status === 'ready_for_return' &&
      request.reporterId === actor.id
    ) {
      actions.push(WORKFLOW_ACTIONS.repairConfirmResult);
    }

    return actions;
  }

  /** Cho người báo, trưởng bộ phận ghi trên phiếu và phòng IT xem chi tiết. */
  private canView(request: RepairRecord, actor: AuthenticatedEmployee) {
    return (
      request.reporterId === actor.id ||
      (actor.isDepartmentHead && actor.departmentId === request.departmentId) ||
      actor.departmentName === 'IT'
    );
  }

  /** Quyền xem hoặc duyệt không bao gồm quyền sửa và gửi phiếu thay người báo. */
  private assertOwner(request: RepairRecord, actor: AuthenticatedEmployee) {
    if (request.reporterId !== actor.id) {
      throw new ForbiddenException('Chỉ người tạo mới được sửa phiếu.');
    }
  }

  /** Dùng cùng điều kiện trưởng IT ở các thao tác cần quyền của trưởng phòng. */
  private assertItHead(actor: AuthenticatedEmployee) {
    if (!this.isItHead(actor)) {
      throw new ForbiddenException(
        'Chỉ Trưởng IT được thực hiện thao tác này.',
      );
    }
  }

  /** Kiểm tra cả phòng ban lẫn chức vụ để phân biệt trưởng IT với trưởng bộ phận khác. */
  private isItHead(actor: AuthenticatedEmployee) {
    return actor.isDepartmentHead && actor.departmentName === 'IT';
  }

  /** Chọn bên mà tài khoản hiện tại được xác nhận và vẫn còn chờ phản hồi. */
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

    // Không cho xác nhận lại hoặc ghi vào phần bàn giao của người khác.
    throw new ForbiddenException('Bạn không có xác nhận bàn giao đang chờ.');
  }

  /** Giữ khóa đến hết giao dịch để lần bàn giao khác không thể đổi người giữ cùng lúc. */
  private lockAsset(db: Database, id: string) {
    return db.execute(sql`select id from assets where id = ${id} for update`);
  }

  /** Khóa phiếu trước khi đọc trạng thái để các lần cập nhật cùng phiếu chạy lần lượt. */
  private async loadLockedRequest(
    db: Database,
    id: string,
    expected: RepairRecord['status'][],
  ) {
    await db.execute(
      sql`select id from repair_requests where id = ${id} for update`,
    );

    return this.requireStatus(db, id, expected);
  }

  /** Ghi chuyển bước kèm người thực hiện và phiên bản để dựng lại timeline. */
  private logAction(
    db: Database,
    request: RepairRecord,
    actor: AuthenticatedEmployee,
    actionType: string,
    status: 'approved' | 'rejected' | 'pending',
    newStatus = request.status, // Có hành động chỉ thêm sự kiện mà không chuyển bước.
    reason?: string,
    revision = request.currentRevision, // Lần gửi lại truyền phiên bản mới vào đây.
  ) {
    // Dùng giao dịch của hàm gọi để nhật ký chỉ tồn tại nếu cập nhật phiếu thành công.
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
