import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, DrizzleQueryError, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { CreateRepairRequestDto } from './dto/create-repair-request.dto.js';
import { UpdateRepairRequestDto } from './dto/update-repair-request.dto.js';
import { RepairRequest } from './entities/repair-request.entity.js';
import { CreateMyRepairRequestDto } from './dto/create-my-repair-request.dto.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  AssessRepairDto,
  AssignRepairDto,
  CompleteRepairDto,
  ConfirmRepairDto,
  RepairApprovalDto,
} from './dto/repair-workflow.dto.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

@Injectable()
export class RepairRequestsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly audit: RequestAuditService,
  ) {}

  async create(
    createRepairRequestDto: CreateRepairRequestDto,
    actor: AuthenticatedEmployee,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        const db = tx as unknown as NodePgDatabase<typeof schema>;
        const [newRecord] = await db
          .insert(schema.repairRequests)
          .values({
            ...createRepairRequestDto,
            reporterId: actor.id,
            departmentId: actor.departmentId,
            status: 'reported',
          })
          .returning();
        await this.audit.log(db, {
          requestType: 'repair',
          requestId: newRecord.id,
          actionType: 'reported',
          approvedBy: newRecord.reporterId,
          approverRole: actor.roleName,
          status: 'approved',
        });
        return new RepairRequest(newRecord);
      });
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu yêu cầu sửa chữa đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo yêu cầu sửa chữa');
    }
  }

  // Tạo yêu cầu pending và lưu thông tin ảnh, video đi kèm
  async createMine(
    actor: AuthenticatedEmployee,
    dto: CreateMyRepairRequestDto,
    files: Express.Multer.File[],
  ) {
    const [asset] = await this.db
      .select({ id: schema.assets.id })
      .from(schema.assets)
      .where(
        and(
          eq(schema.assets.id, dto.assetId),
          eq(schema.assets.currentUserId, actor.id),
        ),
      );

    if (!asset) {
      throw new NotFoundException('Không tìm thấy tài sản được quản lý.');
    }

    return this.db.transaction(async (tx) => {
      const [request] = await tx
        .insert(schema.repairRequests)
        .values({
          assetId: dto.assetId,
          reporterId: actor.id,
          departmentId: actor.departmentId,
          reportDate: new Date().toISOString().slice(0, 10),
          issueDescription: dto.issueDescription,
          status: 'reported',
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
        actionType: 'reported',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
        metadata: { attachmentCount: files.length },
      });

      return new RepairRequest(request);
    });
  }

  /** Đọc và khóa luồng bằng trạng thái mong đợi trước mỗi hành động nghiệp vụ. */
  private async requireStatus(
    db: NodePgDatabase<typeof schema>,
    id: string,
    expected: (typeof schema.repairStatusEnum.enumValues)[number],
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
    if (request.status !== expected) {
      throw new BadRequestException(
        `Yêu cầu phải ở trạng thái ${expected}, trạng thái hiện tại là ${request.status}`,
      );
    }
    return request;
  }

  /**
   * IT đánh giá hư hỏng và chọn nhánh xử lý. Chi phí cần phê duyệt sẽ đi qua
   * approval_pending; trường hợp đơn giản có thể chuyển thẳng sang in_progress.
   */
  async assess(id: string, dto: AssessRepairDto, actor: AuthenticatedEmployee) {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;
      await this.requireStatus(db, id, 'reported');
      const status = dto.needsApproval ? 'approval_pending' : 'in_progress';
      const [request] = await db
        .update(schema.repairRequests)
        .set({
          status,
          assessedBy: actor.id,
          assessedAt: new Date(),
          assessmentNotes: dto.notes,
          needsApproval: dto.needsApproval,
          estimatedRepairCost: dto.estimatedCost,
          updatedAt: new Date(),
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();
      await this.audit.log(db, {
        requestType: 'repair',
        requestId: id,
        actionType: 'assessed',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
        metadata: {
          needsApproval: dto.needsApproval,
          estimatedCost: dto.estimatedCost,
        },
      });
      return new RepairRequest(request);
    });
  }

  /** Trưởng bộ phận duyệt chi phí hoặc đóng yêu cầu khi không chấp thuận. */
  async approveDepartment(
    id: string,
    dto: RepairApprovalDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;
      const current = await this.requireStatus(db, id, 'approval_pending');
      if (current.departmentId !== actor.departmentId) {
        throw new BadRequestException(
          'Không thể duyệt sửa chữa của phòng ban khác',
        );
      }
      const status = dto.approved ? 'in_progress' : 'closed';
      const [request] = await db
        .update(schema.repairRequests)
        .set({
          status,
          ...(dto.approved
            ? { approvedBy: actor.id, approvedAt: new Date() }
            : { closedAt: new Date() }),
          updatedAt: new Date(),
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();
      await this.audit.log(db, {
        requestType: 'repair',
        requestId: id,
        actionType: dto.approved ? 'approval_confirmed' : 'cancelled',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: dto.approved ? 'approved' : 'rejected',
        notes: dto.note,
      });
      return new RepairRequest(request);
    });
  }

  /** Phân công kỹ thuật viên khi yêu cầu đã sẵn sàng xử lý. */
  async assign(id: string, dto: AssignRepairDto, actor: AuthenticatedEmployee) {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;
      await this.requireStatus(db, id, 'in_progress');
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
      await this.requireStatus(db, id, 'in_progress');
      const [request] = await db
        .update(schema.repairRequests)
        .set({
          status: 'completed',
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
      const current = await this.requireStatus(db, id, 'completed');
      if (current.reporterId !== actor.id) {
        throw new BadRequestException(
          'Chỉ người báo hỏng mới được nghiệm thu kết quả',
        );
      }
      const now = new Date();
      const status = dto.accepted ? 'closed' : 'in_progress';
      const [request] = await db
        .update(schema.repairRequests)
        .set({
          status,
          confirmedBy: actor.id,
          confirmedAt: now,
          confirmationStatus: dto.accepted ? 'approved' : 'rejected',
          closedAt: dto.accepted ? now : null,
          completedAt: dto.accepted ? undefined : null,
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
        notes: dto.note,
      });
      return new RepairRequest(request);
    });
  }

  async findAll() {
    const records = await this.db.select().from(schema.repairRequests);

    return records.map((record) => new RepairRequest(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.repairRequests)
      .where(eq(schema.repairRequests.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy yêu cầu sửa chữa có ID ${id}`,
      );
    }

    return new RepairRequest(record);
  }

  async update(id: string, updateRepairRequestDto: UpdateRepairRequestDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.repairRequests)
        .set({
          ...updateRepairRequestDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.repairRequests.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy yêu cầu sửa chữa có ID ${id}`,
        );
      }

      return new RepairRequest(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu yêu cầu sửa chữa đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật yêu cầu sửa chữa',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.repairRequests)
        .where(eq(schema.repairRequests.id, id))
        .returning({ deletedId: schema.repairRequests.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy yêu cầu sửa chữa có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa yêu cầu sửa chữa vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa yêu cầu sửa chữa');
    }
  }
}
