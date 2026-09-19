import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  CreateTransferRequestDto,
  TransferApprovalDto,
} from './dto/transfer-request.dto.js';
import { TransferRequest } from './entities/transfer-request.entity.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

@Injectable()
export class TransferRequestsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly audit: RequestAuditService,
  ) {}

  /** Tạo yêu cầu ở trạng thái requested và ghi nhận người khởi tạo ngay lập tức. */
  async create(dto: CreateTransferRequestDto, actor: AuthenticatedEmployee) {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;
      const [request] = await db
        .insert(schema.transferRequests)
        .values({
          ...dto,
          initiatedBy: actor.id,
          fromDepartmentId: actor.departmentId,
        })
        .returning();
      await this.audit.log(db, {
        requestType: 'transfer',
        requestId: request.id,
        actionType: 'requested',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
      });
      return new TransferRequest(request);
    });
  }

  async findAll() {
    const requests = await this.db.select().from(schema.transferRequests);
    return requests.map((request) => new TransferRequest(request));
  }

  async findOne(id: string) {
    const [request] = await this.db
      .select()
      .from(schema.transferRequests)
      .where(eq(schema.transferRequests.id, id));
    if (!request)
      throw new NotFoundException(
        `Không tìm thấy yêu cầu điều chuyển có ID ${id}`,
      );
    return new TransferRequest(request);
  }

  private async requireStatus(
    db: NodePgDatabase<typeof schema>,
    id: string,
    expected: (typeof schema.transferStatusEnum.enumValues)[number],
  ) {
    const [request] = await db
      .select()
      .from(schema.transferRequests)
      .where(eq(schema.transferRequests.id, id));
    if (!request)
      throw new NotFoundException(
        `Không tìm thấy yêu cầu điều chuyển có ID ${id}`,
      );
    if (request.status !== expected) {
      throw new BadRequestException(
        `Yêu cầu phải ở trạng thái ${expected}, trạng thái hiện tại là ${request.status}`,
      );
    }
    return request;
  }

  /** Trưởng bộ phận có thể duyệt hoặc hủy; yêu cầu đã hủy không được đi tiếp. */
  async approveDepartment(
    id: string,
    dto: TransferApprovalDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;
      const current = await this.requireStatus(db, id, 'requested');
      if (current.fromDepartmentId !== actor.departmentId) {
        throw new BadRequestException(
          'Không thể duyệt điều chuyển của phòng ban khác',
        );
      }
      const status = dto.approved ? 'dept_approved' : 'cancelled';
      const [request] = await db
        .update(schema.transferRequests)
        .set({
          status,
          ...(dto.approved
            ? {
                deptHeadApprovedBy: actor.id,
                deptHeadApprovedAt: new Date(),
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.transferRequests.id, id))
        .returning();
      await this.audit.log(db, {
        requestType: 'transfer',
        requestId: id,
        actionType: status,
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: dto.approved ? 'approved' : 'rejected',
        notes: dto.note,
      });
      return new TransferRequest(request);
    });
  }

  /** Bộ phận tài sản xác minh thông tin trước khi mở bước ký nhận hai phía. */
  async verify(id: string, actor: AuthenticatedEmployee) {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;
      await this.requireStatus(db, id, 'dept_approved');
      const [request] = await db
        .update(schema.transferRequests)
        .set({
          status: 'handoff_pending',
          assetTeamVerifiedBy: actor.id,
          assetTeamVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.transferRequests.id, id))
        .returning();
      await this.audit.log(db, {
        requestType: 'transfer',
        requestId: id,
        actionType: 'verified',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
      });
      return new TransferRequest(request);
    });
  }

  /**
   * Mỗi bên chỉ ký một lần. Khi đủ hai chữ ký, quyền quản lý tài sản được cập nhật
   * trong cùng transaction rồi yêu cầu mới chuyển sang completed.
   */
  async confirmHandoff(id: string, actor: AuthenticatedEmployee) {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as NodePgDatabase<typeof schema>;
      const current = await this.requireStatus(db, id, 'handoff_pending');
      const role =
        current.initiatedBy === actor.id
          ? 'sender'
          : current.toUserId === actor.id
            ? 'receiver'
            : null;
      if (!role) {
        throw new BadRequestException(
          'Chỉ bên giao hoặc bên nhận mới được xác nhận',
        );
      }
      if (role === 'sender' && current.senderConfirmedAt) {
        throw new BadRequestException('Bên giao đã xác nhận yêu cầu này');
      }
      if (role === 'receiver' && current.receiverConfirmedAt) {
        throw new BadRequestException('Bên nhận đã xác nhận yêu cầu này');
      }
      const [signed] = await db
        .update(schema.transferRequests)
        .set({
          ...(role === 'sender'
            ? { senderConfirmedBy: actor.id, senderConfirmedAt: new Date() }
            : {
                receiverConfirmedBy: actor.id,
                receiverConfirmedAt: new Date(),
              }),
          updatedAt: new Date(),
        })
        .where(eq(schema.transferRequests.id, id))
        .returning();

      let result = signed;
      if (signed.senderConfirmedAt && signed.receiverConfirmedAt) {
        await db
          .update(schema.assets)
          .set({
            currentUserId: signed.toUserId,
            currentManagingDepartmentId: signed.toDepartmentId,
            currentLocation: signed.newLocation,
            updatedAt: new Date(),
          })
          .where(eq(schema.assets.id, signed.assetId));
        [result] = await db
          .update(schema.transferRequests)
          .set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.transferRequests.id, id))
          .returning();
        await this.audit.log(db, {
          requestType: 'transfer',
          requestId: id,
          actionType: 'completed',
          approvedBy: actor.id,
          approverRole: actor.roleName,
          status: 'approved',
        });
      } else {
        await this.audit.log(db, {
          requestType: 'transfer',
          requestId: id,
          actionType: `${role}_confirmed`,
          approvedBy: actor.id,
          approverRole: actor.roleName,
          status: 'approved',
        });
      }
      return new TransferRequest(result);
    });
  }
}
