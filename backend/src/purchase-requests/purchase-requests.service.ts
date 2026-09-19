import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleQueryError, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto.js';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto.js';
import { PurchaseRequest } from './entities/purchase-request.entity.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  AllocateAssetsDto,
  ApprovalDecisionDto,
  CreateOrderDto,
  ReceiveAssetsDto,
} from './dto/purchase-workflow.dto.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

@Injectable()
export class PurchaseRequestsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly audit: RequestAuditService,
  ) {}

  /**
   * Kiểm tra trạng thái hiện tại trước khi cập nhật để ngăn duyệt sai thứ tự hoặc
   * gửi lại cùng một hành động. Lỗi nghiệp vụ được trả về 400 thay vì che thành lỗi DB.
   */
  private async requireStatus(
    db: NodePgDatabase<typeof schema>,
    id: string,
    expected: (typeof schema.purchaseStatusEnum.enumValues)[number],
  ) {
    const [request] = await db
      .select()
      .from(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.id, id));
    if (!request) {
      throw new NotFoundException(`Không tìm thấy yêu cầu mua sắm có ID ${id}`);
    }
    if (request.status !== expected) {
      throw new BadRequestException(
        `Yêu cầu phải ở trạng thái ${expected}, trạng thái hiện tại là ${request.status}`,
      );
    }
    return request;
  }

  /** Chuyển bản nháp sang hàng đợi duyệt và ghi nhận chính người gửi yêu cầu. */
  async submit(id: string, actor: AuthenticatedEmployee) {
    return this.db.transaction(async (tx) => {
      const transaction = tx as unknown as NodePgDatabase<typeof schema>;
      const current = await this.requireStatus(transaction, id, 'draft');
      if (current.requesterId !== actor.id) {
        throw new BadRequestException('Chỉ người tạo mới được gửi yêu cầu này');
      }
      const [request] = await transaction
        .update(schema.purchaseRequests)
        .set({ status: 'submitted', updatedAt: new Date() })
        .where(eq(schema.purchaseRequests.id, id))
        .returning();
      await this.audit.log(transaction, {
        requestType: 'purchase',
        requestId: id,
        actionType: 'submitted',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
      });
      return new PurchaseRequest(request);
    });
  }

  /** Bộ phận phê duyệt nhu cầu; từ chối sẽ đóng luồng bằng trạng thái cancelled. */
  async approveDepartment(
    id: string,
    dto: ApprovalDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.approveStage(
      id,
      dto,
      actor,
      'submitted',
      'dept_approved',
      {
        deptHeadId: actor.id,
        deptHeadApprovedAt: new Date(),
      },
      true,
    );
  }

  /** Kế toán chỉ được duyệt sau trưởng bộ phận để giữ luồng một chiều. */
  async approveFinance(
    id: string,
    dto: ApprovalDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.approveStage(
      id,
      dto,
      actor,
      'dept_approved',
      'finance_approved',
      {
        financeReviewedBy: actor.id,
        financeReviewedAt: new Date(),
      },
    );
  }

  /** Điều hành là cấp duyệt cuối trước khi bộ phận mua hàng tạo đơn. */
  async approveExecutive(
    id: string,
    dto: ApprovalDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.approveStage(
      id,
      dto,
      actor,
      'finance_approved',
      'exec_approved',
      {
        execApprovedBy: actor.id,
        execApprovedAt: new Date(),
      },
    );
  }

  private async approveStage(
    id: string,
    dto: ApprovalDecisionDto,
    actor: AuthenticatedEmployee,
    expected: (typeof schema.purchaseStatusEnum.enumValues)[number],
    approvedStatus: (typeof schema.purchaseStatusEnum.enumValues)[number],
    approvalFields: Record<string, unknown>,
    requireSameDepartment = false,
  ) {
    return this.db.transaction(async (tx) => {
      const transaction = tx as unknown as NodePgDatabase<typeof schema>;
      const current = await this.requireStatus(transaction, id, expected);
      if (
        requireSameDepartment &&
        current.departmentId !== actor.departmentId
      ) {
        throw new BadRequestException(
          'Không thể duyệt yêu cầu của phòng ban khác',
        );
      }
      const nextStatus = dto.approved ? approvedStatus : 'cancelled';
      const [request] = await transaction
        .update(schema.purchaseRequests)
        .set({
          ...(dto.approved ? approvalFields : {}),
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseRequests.id, id))
        .returning();
      await this.audit.log(transaction, {
        requestType: 'purchase',
        requestId: id,
        actionType: nextStatus,
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: dto.approved ? 'approved' : 'rejected',
        notes: dto.note,
      });
      return new PurchaseRequest(request);
    });
  }

  /** Lưu thông tin nhà cung cấp và hóa đơn sau khi đủ ba cấp phê duyệt. */
  async createOrder(
    id: string,
    dto: CreateOrderDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.db.transaction(async (tx) => {
      const transaction = tx as unknown as NodePgDatabase<typeof schema>;
      await this.requireStatus(transaction, id, 'exec_approved');
      const [request] = await transaction
        .update(schema.purchaseRequests)
        .set({
          status: 'ordered',
          procurementBy: actor.id,
          procuredAt: new Date(),
          supplierId: dto.supplierId,
          invoiceNumber: dto.invoiceNumber,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseRequests.id, id))
        .returning();
      await this.audit.log(transaction, {
        requestType: 'purchase',
        requestId: id,
        actionType: 'ordered',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
        metadata: {
          supplierId: dto.supplierId,
          invoiceNumber: dto.invoiceNumber,
        },
      });
      return new PurchaseRequest(request);
    });
  }

  /**
   * Tạo tài sản thực tế từ lô hàng đã đặt. Mã tài sản và QR do client cung cấp
   * để phù hợp quy ước hiện có; transaction ngăn tạo dở một phần lô hàng.
   */
  async receiveAssets(
    id: string,
    dto: ReceiveAssetsDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.db.transaction(async (tx) => {
      const transaction = tx as unknown as NodePgDatabase<typeof schema>;
      const request = await this.requireStatus(transaction, id, 'ordered');
      if (dto.assets.length !== request.quantity) {
        throw new BadRequestException(
          `Phải tạo đúng ${request.quantity} tài sản cho yêu cầu này`,
        );
      }
      if (!request.supplierId) {
        throw new BadRequestException('Yêu cầu chưa có nhà cung cấp');
      }
      const created = await transaction
        .insert(schema.assets)
        .values(
          dto.assets.map((asset) => ({
            ...asset,
            assetCategoryId: request.assetCategoryId,
            supplierId: request.supplierId!,
            currentManagingDepartmentId: request.departmentId,
            currentValue: asset.initialValue,
            status: 'active',
          })),
        )
        .returning({ id: schema.assets.id });
      const assetIds = created.map((asset) => asset.id);
      const [updated] = await transaction
        .update(schema.purchaseRequests)
        .set({
          status: 'asset_created',
          receivedAt: new Date(),
          receivedBy: actor.id,
          receivedAssets: assetIds,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseRequests.id, id))
        .returning();
      await this.audit.log(transaction, {
        requestType: 'purchase',
        requestId: id,
        actionType: 'asset_created',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
        metadata: { assetIds },
      });
      return new PurchaseRequest(updated);
    });
  }

  /** Gán toàn bộ tài sản vừa nhận cho người dùng và hoàn tất yêu cầu mua sắm. */
  async allocateAssets(
    id: string,
    dto: AllocateAssetsDto,
    actor: AuthenticatedEmployee,
  ) {
    return this.db.transaction(async (tx) => {
      const transaction = tx as unknown as NodePgDatabase<typeof schema>;
      const request = await this.requireStatus(
        transaction,
        id,
        'asset_created',
      );
      if (!request.receivedAssets?.length) {
        throw new BadRequestException('Yêu cầu chưa có tài sản để bàn giao');
      }
      for (const assetId of request.receivedAssets) {
        await transaction
          .update(schema.assets)
          .set({
            currentUserId: dto.allocatedToUserId,
            updatedAt: new Date(),
          })
          .where(eq(schema.assets.id, assetId));
      }
      const [updated] = await transaction
        .update(schema.purchaseRequests)
        .set({
          status: 'allocated',
          allocatedTo: dto.allocatedToUserId,
          allocatedAt: new Date(),
          allocationConfirmedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseRequests.id, id))
        .returning();
      await this.audit.log(transaction, {
        requestType: 'purchase',
        requestId: id,
        actionType: 'allocated',
        approvedBy: actor.id,
        approverRole: actor.roleName,
        status: 'approved',
        metadata: { allocatedToUserId: dto.allocatedToUserId },
      });
      return new PurchaseRequest(updated);
    });
  }

  async create(
    createPurchaseRequestDto: CreatePurchaseRequestDto,
    actor: AuthenticatedEmployee,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        const db = tx as unknown as NodePgDatabase<typeof schema>;
        const [newRecord] = await db
          .insert(schema.purchaseRequests)
          .values({
            ...createPurchaseRequestDto,
            requesterId: actor.id,
            departmentId: actor.departmentId,
            status: 'draft',
          })
          .returning();
        await this.audit.log(db, {
          requestType: 'purchase',
          requestId: newRecord.id,
          actionType: 'draft_created',
          approvedBy: newRecord.requesterId,
          approverRole: 'employee',
          status: 'pending',
        });
        return new PurchaseRequest(newRecord);
      });
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu yêu cầu mua sắm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo yêu cầu mua sắm');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.purchaseRequests);

    return records.map((record) => new PurchaseRequest(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.id, id));

    if (!record) {
      throw new NotFoundException(`Không tìm thấy yêu cầu mua sắm có ID ${id}`);
    }

    return new PurchaseRequest(record);
  }

  async update(id: string, updatePurchaseRequestDto: UpdatePurchaseRequestDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.purchaseRequests)
        .set({
          ...updatePurchaseRequestDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseRequests.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy yêu cầu mua sắm có ID ${id}`,
        );
      }

      return new PurchaseRequest(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu yêu cầu mua sắm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật yêu cầu mua sắm',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.purchaseRequests)
        .where(eq(schema.purchaseRequests.id, id))
        .returning({ deletedId: schema.purchaseRequests.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy yêu cầu mua sắm có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa yêu cầu mua sắm vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa yêu cầu mua sắm');
    }
  }
}
