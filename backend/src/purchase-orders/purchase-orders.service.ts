import { countOrderTasks } from './purchase-order-queries.js';
import { countApprovalQueue } from './purchase-order-queries.js';
import { countEligibleRequests } from './purchase-order-queries.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  loadOrderItems,
  loadOrderProgress,
  lockOrder,
} from '../purchase-receipts/purchase-receipt-queries.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  PurchaseOrderDecisionDto,
  SavePurchaseOrderDto,
} from './dto/purchase-order.dto.js';
import {
  insertOrderItems,
  loadOrderInput,
  validateDates,
} from './purchase-order-input.js';
import { notifyProcurementHeads } from './purchase-order-notifications.js';
import { recalculateRequestStatus } from './purchase-order-progress.js';
import {
  assertProcurementAction,
  findAll,
  findApprovalQueue,
  findEligibleRequests,
  findOne,
  requireOrder,
  requireRequest,
} from './purchase-order-queries.js';

type Database = NodePgDatabase<typeof schema>;
type PurchaseOrder = typeof schema.purchaseOrders.$inferSelect;
type PurchaseOrderStatus =
  (typeof schema.purchaseOrderStatusEnum.enumValues)[number];
@Injectable()
export class PurchaseOrdersService {
  countEligibleRequests(actor: AuthenticatedEmployee) {
    return countEligibleRequests(this.authorization, this.db, actor);
  }

  countApprovalQueue(actor: AuthenticatedEmployee) {
    return countApprovalQueue(this.authorization, this.db, actor);
  }

  countOrderTasks(actor: AuthenticatedEmployee) {
    return countOrderTasks(this.db, actor);
  }

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly authorization: PurchaseAuthorizationService,
    private readonly audit: RequestAuditService,
    private readonly notifications: NotificationsService,
  ) {}
  findEligibleRequests(actor: AuthenticatedEmployee) {
    return findEligibleRequests(this.authorization, this.db, actor);
  }

  findAll(
    actor: AuthenticatedEmployee,
    filters: { requestId?: string; supplierId?: string; status?: string },
  ) {
    return findAll(this.db, actor, filters);
  }

  findApprovalQueue(actor: AuthenticatedEmployee) {
    return findApprovalQueue(this.authorization, this.db, actor);
  }

  findOne(id: string, actor: AuthenticatedEmployee) {
    return findOne(this.audit, this.authorization, this.db, id, actor);
  }
  async create(dto: CreatePurchaseOrderDto, actor: AuthenticatedEmployee) {
    // Kiểm tra xem người tạo có phải là người thuộc phòng Thu mua
    // và có quyền tạo đơn mua hay không
    assertProcurementAction(
      this.authorization,
      actor,
      WORKFLOW_ACTIONS.purchaseOrderCreate,
    );

    if (dto.submitForApproval) {
      assertProcurementAction(
        this.authorization,
        actor,
        WORKFLOW_ACTIONS.purchaseOrderSubmit,
      );
    }

    // Kiểm tra xem ngày giao dự kiến không đứng trước ngày đặt hàng
    validateDates(dto);

    // Lý do dùng DB transaction để các thao tác tạo đơn mua (gồm tạo data, row trong DB)
    // cập nhật trạng thái, v.v. phải cùng thành công
    // Nếu một bước lỗi thì toàn bộ data, row sẽ được rollback.
    const orderId = await this.db.transaction(async (tx) => {
      // Ngăn nhiều request tạo đơn mua cho cùng một đề nghị
      await this.lockRequest(tx, dto.purchaseRequestId);
      const context = await loadOrderInput(tx, dto);
      const [order] = await tx
        .insert(schema.purchaseOrders)
        .values({
          purchaseOrderCode: this.createOrderCode(),
          purchaseRequestId: context.request.id,
          requestRevisionId: context.revision.id,
          contractId: dto.contractId ?? null,
          supplierId: dto.supplierId,
          createdByEmployeeId: actor.id,
          orderDate: dto.orderDate,
          expectedDeliveryDate: dto.expectedDeliveryDate,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      await insertOrderItems(tx, order.id, dto, context.items, actor.id);
      await recalculateRequestStatus(tx, context.request.id, actor.id);
      await this.audit.logPurchase(tx, {
        requestId: context.request.id,
        revision: context.request.currentRevision,
        actionType: 'purchase.order.create',
        actor,
        result: 'pending',
        previousStatus: context.request.status,
        newStatus: 'ordering',
        entityType: 'order',
        entityId: order.id,
      });

      if (dto.submitForApproval) {
        await this.submitDraft(tx, order, actor);
      }

      return order.id;
    });

    return findOne(this.audit, this.authorization, this.db, orderId, actor);
  }

  async update(
    id: string,
    dto: SavePurchaseOrderDto,
    actor: AuthenticatedEmployee,
  ) {
    assertProcurementAction(
      this.authorization,
      actor,
      WORKFLOW_ACTIONS.purchaseOrderCreate,
    );
    validateDates(dto);

    await this.db.transaction(async (tx) => {
      const candidate = await requireOrder(tx, id);

      await this.lockRequest(tx, candidate.purchaseRequestId);

      const order = await requireOrder(tx, id, ['draft']);

      this.assertOrderCreator(order, actor);

      if (order.purchaseRequestId !== dto.purchaseRequestId) {
        throw new BadRequestException('Không thể đổi đề nghị nguồn của PO.');
      }

      const context = await loadOrderInput(tx, dto, id);

      await tx
        .update(schema.purchaseOrders)
        .set({
          supplierId: dto.supplierId,
          contractId: dto.contractId ?? null,
          orderDate: dto.orderDate,
          expectedDeliveryDate: dto.expectedDeliveryDate,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(schema.purchaseOrders.id, id));
      await tx
        .delete(schema.purchaseOrderItems)
        .where(eq(schema.purchaseOrderItems.purchaseOrderId, id));
      await insertOrderItems(tx, id, dto, context.items, actor.id);
      await this.audit.logPurchase(tx, {
        requestId: order.purchaseRequestId,
        revision: context.request.currentRevision,
        actionType: 'purchase.order.update',
        actor,
        result: 'pending',
        previousStatus: order.status,
        newStatus: order.status,
        entityType: 'order',
        entityId: id,
      });
    });

    return this.findOne(id, actor);
  }

  async submit(id: string, actor: AuthenticatedEmployee) {
    assertProcurementAction(
      this.authorization,
      actor,
      WORKFLOW_ACTIONS.purchaseOrderSubmit,
    );
    await this.db.transaction(async (tx) => {
      const candidate = await requireOrder(tx, id);

      await this.lockRequest(tx, candidate.purchaseRequestId);
      // Đọc lại sau khóa để update/submit cạnh tranh chỉ có một thao tác thắng.
      const order = await requireOrder(tx, id, ['draft']);

      this.assertOrderCreator(order, actor);
      await this.submitDraft(tx, order, actor);
    });

    return this.findOne(id, actor);
  }

  private async submitDraft(
    tx: Database,
    order: PurchaseOrder,
    actor: AuthenticatedEmployee,
  ) {
    const id = order.id;
    const now = new Date();

    await tx
      .update(schema.purchaseOrders)
      .set({
        status: 'pending_procurement_head',
        submittedAt: now,
        submittedBy: actor.id,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.purchaseOrders.id, id));
    const request = await requireRequest(tx, order.purchaseRequestId);

    await this.audit.logPurchase(tx, {
      requestId: request.id,
      revision: request.currentRevision,
      actionType: 'purchase.order.submit',
      actor,
      result: 'pending',
      previousStatus: order.status,
      newStatus: 'pending_procurement_head',
      entityType: 'order',
      entityId: id,
    });
    await notifyProcurementHeads(this.notifications, tx, {
      recipientEvent: 'purchase_order_pending_approval',
      order,
      title: 'Đơn đặt mua chờ duyệt',
      body: `${order.purchaseOrderCode} đang chờ Trưởng Thu mua xử lý.`,
    });
  }

  async decide(
    id: string,
    dto: PurchaseOrderDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    assertProcurementAction(
      this.authorization,
      actor,
      WORKFLOW_ACTIONS.purchaseOrderApprove,
    );
    await this.db.transaction(async (tx) => {
      const candidate = await requireOrder(tx, id);

      await this.lockRequest(tx, candidate.purchaseRequestId);
      const order = await requireOrder(tx, id, ['pending_procurement_head']);
      const request = await requireRequest(tx, order.purchaseRequestId);
      const now = new Date();
      const nextStatus: PurchaseOrderStatus = dto.approved ? 'issued' : 'draft';

      await tx
        .update(schema.purchaseOrders)
        .set({
          status: nextStatus,
          approvedAt: dto.approved ? now : null,
          approvedBy: dto.approved ? actor.id : null,
          submittedAt: dto.approved ? order.submittedAt : null,
          submittedBy: dto.approved ? order.submittedBy : null,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.purchaseOrders.id, id));
      await recalculateRequestStatus(tx, request.id, actor.id);
      await this.audit.logPurchase(tx, {
        requestId: request.id,
        revision: request.currentRevision,
        actionType: dto.approved
          ? 'purchase.order.approve'
          : 'purchase.order.reject',
        actor,
        result: dto.approved ? 'approved' : 'rejected',
        previousStatus: order.status,
        newStatus: nextStatus,
        reason: dto.reason,
        entityType: 'order',
        entityId: id,
      });
      await this.notifications.create(tx, {
        recipientId: order.createdByEmployeeId,
        eventType: dto.approved
          ? 'purchase_order_issued'
          : 'purchase_order_rejected',
        entityType: 'order',
        entityId: id,
        title: dto.approved
          ? 'Đơn đặt mua đã phát hành'
          : 'Đơn đặt mua bị trả về',
        body: dto.approved
          ? `${order.purchaseOrderCode} đã được duyệt và phát hành.`
          : `${order.purchaseOrderCode} cần chỉnh sửa: ${dto.reason}`,
        metadata: { purchaseRequestId: request.id },
      });
    });

    return this.findOne(id, actor);
  }

  async cancel(
    id: string,
    dto: CancelPurchaseOrderDto,
    actor: AuthenticatedEmployee,
  ) {
    assertProcurementAction(
      this.authorization,
      actor,
      WORKFLOW_ACTIONS.purchaseOrderCancel,
    );
    await this.db.transaction(async (tx) => {
      const candidate = await requireOrder(tx, id);

      await this.lockRequest(tx, candidate.purchaseRequestId);
      await lockOrder(tx, id);
      const order = await requireOrder(tx, id, ['issued']);

      const items = await loadOrderItems(tx, id);
      const progress = await loadOrderProgress(tx, items);

      if ([...progress.values()].some((line) => line.pending > 0)) {
        throw new ConflictException(
          'Không thể hủy đơn mua khi vẫn còn hàng chờ kiểm tra.',
        );
      }

      if ([...progress.values()].some((line) => line.accepted > 0)) {
        throw new ConflictException(
          'PO đã có hàng đạt; hãy dùng thao tác đóng thiếu thay vì hủy.',
        );
      }

      const now = new Date();

      await tx
        .update(schema.purchaseOrders)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          cancelledBy: actor.id,
          cancellationReason: dto.reason,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.purchaseOrders.id, id));
      const request = await requireRequest(tx, order.purchaseRequestId);

      await recalculateRequestStatus(tx, request.id, actor.id);
      await this.audit.logPurchase(tx, {
        requestId: request.id,
        revision: request.currentRevision,
        actionType: 'purchase.order.cancel',
        actor,
        result: 'rejected',
        previousStatus: order.status,
        newStatus: 'cancelled',
        reason: dto.reason,
        entityType: 'order',
        entityId: id,
      });
      await this.notifications.create(tx, {
        recipientId: order.createdByEmployeeId,
        eventType: 'purchase_order_rejected',
        entityType: 'order',
        entityId: id,
        title: 'Đơn đặt mua đã hủy',
        body: `${order.purchaseOrderCode} đã hủy: ${dto.reason}`,
        metadata: { purchaseRequestId: request.id, cancelled: true },
      });
    });

    return this.findOne(id, actor);
  }

  private async lockRequest(db: Database, requestId: string): Promise<void> {
    const result = await db.execute(
      sql`select id from purchase_requests where id = ${requestId} for update`,
    );

    if (result.rows.length === 0)
      throw new NotFoundException('Không tìm thấy đề nghị mua.');
  }

  private assertOrderCreator(
    order: PurchaseOrder,
    actor: AuthenticatedEmployee,
  ): void {
    if (order.createdByEmployeeId !== actor.id) {
      throw new ForbiddenException('Bạn không phải người lập đơn đặt mua này.');
    }
  }

  private createOrderCode(): string {
    const year = new Date().getUTCFullYear();

    return `PO-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}

export {
  calculateOrderLineTotals,
  deriveRequestOrderStatus,
} from './purchase-order-calculations.js';
