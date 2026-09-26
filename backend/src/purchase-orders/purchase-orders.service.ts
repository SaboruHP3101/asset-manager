import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  CancelPurchaseOrderDto,
  PurchaseOrderDecisionDto,
  SavePurchaseOrderDto,
} from './dto/purchase-order.dto.js';

type Database = NodePgDatabase<typeof schema>;
type PurchaseOrder = typeof schema.purchaseOrders.$inferSelect;
type PurchaseOrderStatus =
  (typeof schema.purchaseOrderStatusEnum.enumValues)[number];

const RESERVED_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'draft',
  'pending_procurement_head',
  'issued',
  'partially_received',
  'fully_received',
  'closed_short',
];
const ISSUED_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'issued',
  'partially_received',
  'fully_received',
  'closed_short',
];

/** Tính VND bằng BigInt và làm tròn VAT tới số gần nhất */
export function calculateOrderLineTotals(
  quantity: number,
  unitPriceExclVat: string,
  vatRate: string,
) {
  const subtotal = BigInt(unitPriceExclVat) * BigInt(quantity);
  const vatHundredths = BigInt(Math.round(Number(vatRate) * 100));
  const vatAmount = (subtotal * vatHundredths + 5000n) / 10000n;

  return {
    subtotalExclVat: subtotal.toString(),
    vatAmount: vatAmount.toString(),
    totalInclVat: (subtotal + vatAmount).toString(),
  };
}

/** Hàm suy ra trạng thái đặt mua của một đề nghị
 * dựa trên số lượng đã duyệt và số lượng đã được đưa vào các đơn mua.
 * Quy tắc:
 *
 * 1. Nếu tất cả số lượng item đã đặt bằng với số lượng duyệt: `fully_ordered`.
 * 2. Nếu có đơn mua đang mua: `ordering`.
 * 3. Nếu không có đơn mua đang mua nào, tức vẫn còn trong giai đoạn vừa duyệt xong: `approved`. */
export function deriveRequestOrderStatus(
  quantities: Array<{ approved: number; issued: number }>,
  hasActiveOrder: boolean,
): 'approved' | 'ordering' | 'fully_ordered' {
  if (quantities.every((item) => item.issued === item.approved)) {
    return 'fully_ordered';
  }

  return hasActiveOrder ? 'ordering' : 'approved';
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly authorization: PurchaseAuthorizationService,
    private readonly audit: RequestAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tạo đơn mua */
  async create(dto: SavePurchaseOrderDto, actor: AuthenticatedEmployee) {
    // Kiểm tra xem người tạo có phải là người thuộc phòng Thu mua
    // và có quyền tạo đơn mua hay không
    this.assertProcurementAction(actor, WORKFLOW_ACTIONS.purchaseOrderCreate);
    // Kiểm tra xem ngày giao dự kiến không đứng trước ngày đặt hàng
    this.validateDates(dto);

    // Lý do dùng DB transaction để các thao tác tạo đơn mua (gồm tạo data, row trong DB)
    // cập nhật trạng thái, v.v. phải cùng thành công
    // Nếu một bước lỗi thì toàn bộ data, row sẽ được rollback.
    const orderId = await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      // Ngăn nhiều request tạo đơn mua cho cùng một đề nghị
      await this.lockRequest(tx, dto.purchaseRequestId);
      const context = await this.loadOrderInput(tx, dto);
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

      await this.insertOrderItems(tx, order.id, dto, context.items, actor.id);
      await this.recalculateRequestStatus(tx, context.request.id, actor.id);
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

      return order.id;
    });

    return this.findOne(orderId, actor);
  }

  /** Cập nhật đơn mua đang ở trạng thái nháp */
  async update(
    id: string,
    dto: SavePurchaseOrderDto,
    actor: AuthenticatedEmployee,
  ) {
    this.assertProcurementAction(actor, WORKFLOW_ACTIONS.purchaseOrderCreate);
    this.validateDates(dto);

    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const candidate = await this.requireOrder(tx, id);

      await this.lockRequest(tx, candidate.purchaseRequestId);

      const order = await this.requireOrder(tx, id, ['draft']);

      this.assertOrderCreator(order, actor);

      if (order.purchaseRequestId !== dto.purchaseRequestId) {
        throw new BadRequestException('Không thể đổi đề nghị nguồn của PO.');
      }

      const context = await this.loadOrderInput(tx, dto, id);

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
      await this.insertOrderItems(tx, id, dto, context.items, actor.id);
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

  /** Chuyển đơn mua nháp sang chờ duyệt và báo cho các Trưởng Thu mua */
  async submit(id: string, actor: AuthenticatedEmployee) {
    this.assertProcurementAction(actor, WORKFLOW_ACTIONS.purchaseOrderSubmit);
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const candidate = await this.requireOrder(tx, id);

      await this.lockRequest(tx, candidate.purchaseRequestId);
      // Đọc lại sau khóa để update/submit cạnh tranh chỉ có một thao tác thắng.
      const order = await this.requireOrder(tx, id, ['draft']);

      this.assertOrderCreator(order, actor);
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
      const request = await this.requireRequest(tx, order.purchaseRequestId);

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
      await this.notifyProcurementHeads(tx, {
        recipientEvent: 'purchase_order_pending_approval',
        order,
        title: 'Đơn đặt mua chờ duyệt',
        body: `${order.purchaseOrderCode} đang chờ Trưởng Thu mua xử lý.`,
      });
    });

    return this.findOne(id, actor);
  }

  /** Duyệt phát hành hoặc từ chối để người lập chỉnh sửa lại bản nháp */
  async decide(
    id: string,
    dto: PurchaseOrderDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    this.assertProcurementAction(actor, WORKFLOW_ACTIONS.purchaseOrderApprove);
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const candidate = await this.requireOrder(tx, id);

      await this.lockRequest(tx, candidate.purchaseRequestId);
      const order = await this.requireOrder(tx, id, [
        'pending_procurement_head',
      ]);
      const request = await this.requireRequest(tx, order.purchaseRequestId);
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
      await this.recalculateRequestStatus(tx, request.id, actor.id);
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

  /** Hủy đơn mua chưa nhận hàng đạt và tính lại tiến độ đặt mua của đề nghị */
  async cancel(
    id: string,
    dto: CancelPurchaseOrderDto,
    actor: AuthenticatedEmployee,
  ) {
    this.assertProcurementAction(actor, WORKFLOW_ACTIONS.purchaseOrderCancel);
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const candidate = await this.requireOrder(tx, id);

      await this.lockRequest(tx, candidate.purchaseRequestId);
      const order = await this.requireOrder(tx, id, ['issued']);

      const [receipt] = await tx
        .select({
          acceptedQuantity: sql<number>`coalesce(sum(${schema.purchaseReceiptItems.acceptedQuantity}), 0)::int`,
        })
        .from(schema.purchaseReceiptItems)
        .innerJoin(
          schema.purchaseOrderItems,
          eq(
            schema.purchaseReceiptItems.purchaseOrderItemId,
            schema.purchaseOrderItems.id,
          ),
        )
        .where(eq(schema.purchaseOrderItems.purchaseOrderId, id));

      if ((receipt?.acceptedQuantity ?? 0) > 0) {
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
      const request = await this.requireRequest(tx, order.purchaseRequestId);

      await this.recalculateRequestStatus(tx, request.id, actor.id);
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

  /** Liệt kê đề nghị có ít nhất một dòng còn số lượng chưa bị đơn mua khác giữ chỗ
   * để nhân viên Thu mua chọn khi tạo đơn mua */
  async findEligibleRequests(actor: AuthenticatedEmployee) {
    this.assertProcurementAction(actor, WORKFLOW_ACTIONS.purchaseOrderCreate);

    const rows = await this.db.execute(sql`
      select pr.id, pr.request_code as "requestCode", pr.status,
             pri.id as "itemId", pri.item_name as "itemName",
             pri.quantity,
             (pri.quantity - coalesce(sum(poi.quantity) filter (
               where po.status <> 'cancelled'
             ), 0))::int as "remainingQuantity",
             q.supplier_id as "supplierId", s.legal_name as "supplierName"
      from purchase_requests pr
      join purchase_request_revisions rev
        on rev.purchase_request_id = pr.id
       and rev.revision_number = pr.current_revision
      join purchase_request_items pri on pri.request_revision_id = rev.id
      join purchase_request_quotes q
        on q.request_item_id = pri.id and q.is_selected = true
      join suppliers s on s.id = q.supplier_id
      left join purchase_order_items poi on poi.purchase_request_item_id = pri.id
      left join purchase_orders po on po.id = poi.purchase_order_id
      where pr.status in ('approved', 'ordering')
      group by pr.id, pr.request_code, pr.status, pri.id, pri.item_name,
               pri.quantity, q.supplier_id, s.legal_name
      having pri.quantity > coalesce(sum(poi.quantity) filter (
        where po.status <> 'cancelled'
      ), 0)
      order by pr.updated_at asc, pri.sort_order asc
    `);

    return rows.rows;
  }

  async findAll(
    actor: AuthenticatedEmployee,
    filters: { requestId?: string; supplierId?: string; status?: string },
  ) {
    const conditions = [];

    if (filters.requestId)
      conditions.push(
        eq(schema.purchaseOrders.purchaseRequestId, filters.requestId),
      );

    if (filters.supplierId)
      conditions.push(eq(schema.purchaseOrders.supplierId, filters.supplierId));

    if (filters.status) {
      if (
        !schema.purchaseOrderStatusEnum.enumValues.includes(
          filters.status as PurchaseOrderStatus,
        )
      ) {
        throw new BadRequestException('Trạng thái PO không hợp lệ.');
      }

      conditions.push(
        eq(schema.purchaseOrders.status, filters.status as PurchaseOrderStatus),
      );
    }

    // Thu mua xem toàn bộ; nhân viên khác chỉ xem đơn mua thuộc request do mình tạo
    if (actor.departmentName !== 'PROCUREMENT') {
      conditions.push(
        or(
          eq(schema.purchaseRequests.requesterId, actor.id),
          ...(actor.isDepartmentHead
            ? [eq(schema.purchaseRequests.departmentId, actor.departmentId)]
            : []),
        )!,
      );
    }

    return this.db
      .select({
        id: schema.purchaseOrders.id,
        purchaseOrderCode: schema.purchaseOrders.purchaseOrderCode,
        purchaseRequestId: schema.purchaseOrders.purchaseRequestId,
        requestCode: schema.purchaseRequests.requestCode,
        supplierId: schema.purchaseOrders.supplierId,
        supplierName: schema.suppliers.legalName,
        status: schema.purchaseOrders.status,
        orderDate: schema.purchaseOrders.orderDate,
        expectedDeliveryDate: schema.purchaseOrders.expectedDeliveryDate,
        updatedAt: schema.purchaseOrders.updatedAt,
      })
      .from(schema.purchaseOrders)
      .innerJoin(
        schema.purchaseRequests,
        eq(schema.purchaseOrders.purchaseRequestId, schema.purchaseRequests.id),
      )
      .innerJoin(
        schema.suppliers,
        eq(schema.purchaseOrders.supplierId, schema.suppliers.id),
      )
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.purchaseOrders.updatedAt));
  }

  /** Trả các đơn mua pending cho Trưởng Thu mua. */
  async findApprovalQueue(actor: AuthenticatedEmployee) {
    this.assertProcurementAction(actor, WORKFLOW_ACTIONS.purchaseOrderApprove);

    return this.findAll(actor, { status: 'pending_procurement_head' });
  }

  /** Kiểm tra phạm vi rồi dựng chi tiết đơn mua với item, tổng tiền và timeline chỉnh sửa */
  async findOne(id: string, actor: AuthenticatedEmployee) {
    const [order] = await this.db
      .select({
        order: schema.purchaseOrders,
        requestCode: schema.purchaseRequests.requestCode,
        requestRevision: schema.purchaseRequests.currentRevision,
        supplierName: schema.suppliers.legalName,
        creatorName: schema.employees.fullName,
      })
      .from(schema.purchaseOrders)
      .innerJoin(
        schema.purchaseRequests,
        eq(schema.purchaseOrders.purchaseRequestId, schema.purchaseRequests.id),
      )
      .innerJoin(
        schema.suppliers,
        eq(schema.purchaseOrders.supplierId, schema.suppliers.id),
      )
      .innerJoin(
        schema.employees,
        eq(schema.purchaseOrders.createdByEmployeeId, schema.employees.id),
      )
      .where(eq(schema.purchaseOrders.id, id));

    if (!order) throw new NotFoundException('Không tìm thấy đơn đặt mua.');

    await this.authorization.assertCanViewRequest(
      order.order.purchaseRequestId,
      actor,
    );

    const items = await this.db
      .select()
      .from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.purchaseOrderId, id))
      .orderBy(asc(schema.purchaseOrderItems.createdAt));
    const totals = this.sumTotals(items);
    const timeline = await this.audit.findTrail(
      'purchase',
      order.order.purchaseRequestId,
    );

    return {
      id,
      status: order.order.status,
      pendingAction: this.pendingAction(order.order.status),
      allowedActions: this.allowedActions(order.order, actor),
      timeline: timeline.filter(
        (event) =>
          (event.metadata as { entityId?: string } | null)?.entityId === id,
      ),
      data: {
        ...order.order,
        requestCode: order.requestCode,
        requestRevision: order.requestRevision,
        supplierName: order.supplierName,
        creatorName: order.creatorName,
        items,
        totals,
      },
    };
  }

  /** Ngăn hai request tạo đơn mua cho cùng một đề nghị cùng lúc.
   * Ví dụ:
   * 1. Request A khoá đề nghị X.
   * 2. Request B cũng tạo đơn mua cho đề nghị X,
   *    nhưng do request A đến trước và khoá đề nghị, nên request B phải chờ A xong.
   * 3. Request A tạo đơn mua đặt 2 sản phẩm và lưu vào DB, sau đó mở khoá cho đề nghị X.
   * 4. Request B được chạy tiếp, lúc này đọc lại DB trường quantity
   *    và thấy không còn số lượng để đặt.
   *
   * Nếu không có có hàm này, cả A và B có thể cùng đọc DB quantity ra "2"
   * rồi tạo tổng cộng 4 sản phẩm.
   */
  private async lockRequest(db: Database, requestId: string): Promise<void> {
    const result = await db.execute(
      sql`select id from purchase_requests where id = ${requestId} for update`,
    );

    if (result.rows.length === 0)
      throw new NotFoundException('Không tìm thấy đề nghị mua.');
  }

  /** Hàm kiểm tra và trả về đề nghị mua, phiên bản hiện tại của đề nghị mua, và danh sách hạng mục và báo giá */
  private async loadOrderInput(
    db: Database,
    dto: SavePurchaseOrderDto,
    excludedOrderId?: string,
  ) {
    // Lấy đề nghị mua đang ở trạng thái "đã duyệt" hoặc "vẫn còn số lượng chưa đặt hết"
    const request = await this.requireRequest(db, dto.purchaseRequestId, [
      'approved',
      'ordering',
    ]);
    // Lấy phiên bản mới nhất của đề nghị mua (đã được duyệt) đã query trước đó
    const [revision] = await db
      .select()
      .from(schema.purchaseRequestRevisions)
      .where(
        and(
          eq(schema.purchaseRequestRevisions.purchaseRequestId, request.id),
          eq(
            schema.purchaseRequestRevisions.revisionNumber,
            request.currentRevision,
          ),
        ),
      );

    if (!revision)
      throw new ConflictException('Phiên bản được duyệt không tồn tại.');

    // Kiểm tra hợp đồng (nếu có) phải thuộc nhà cung cấp của đơn mua
    if (dto.contractId) {
      const [contract] = await db
        .select({ supplierId: schema.purchaseContracts.supplierId })
        .from(schema.purchaseContracts)
        .where(eq(schema.purchaseContracts.id, dto.contractId));

      if (!contract || contract.supplierId !== dto.supplierId) {
        throw new BadRequestException(
          'Hợp đồng không tồn tại hoặc không thuộc nhà cung cấp của đơn mua.',
        );
      }
    }

    const requestedIds = dto.items.map((item) => item.purchaseRequestItemId);

    if (new Set(requestedIds).size !== requestedIds.length) {
      throw new BadRequestException('Mỗi hạng mục chỉ được xuất hiện một lần.');
    }

    const items = await db
      .select({
        id: schema.purchaseRequestItems.id,
        itemName: schema.purchaseRequestItems.itemName,
        approvedQuantity: schema.purchaseRequestItems.quantity,
        selectedQuoteId: schema.purchaseRequestQuotes.id,
        supplierId: schema.purchaseRequestQuotes.supplierId,
        unitPriceExclVat: schema.purchaseRequestQuotes.unitPriceExclVat,
        vatRate: schema.purchaseRequestQuotes.vatRate,
      })
      .from(schema.purchaseRequestItems)
      .innerJoin(
        schema.purchaseRequestQuotes,
        and(
          eq(
            schema.purchaseRequestQuotes.requestItemId,
            schema.purchaseRequestItems.id,
          ),
          eq(schema.purchaseRequestQuotes.isSelected, true),
        ),
      )
      .where(
        and(
          eq(schema.purchaseRequestItems.requestRevisionId, revision.id),
          inArray(schema.purchaseRequestItems.id, requestedIds),
        ),
      );

    if (items.length !== requestedIds.length) {
      throw new BadRequestException(
        'Có hạng mục không thuộc revision hiện tại hoặc chưa chọn báo giá.',
      );
    }

    if (items.some((item) => item.supplierId !== dto.supplierId)) {
      throw new BadRequestException(
        'Một PO chỉ gồm các hạng mục đã chọn cùng nhà cung cấp.',
      );
    }

    // Tính số lượng đã được giữ chỗ trên các đơn mua hiện có cho từng hạng mục đề nghị mua.
    const reservations = await db
      .select({
        itemId: schema.purchaseOrderItems.purchaseRequestItemId,
        quantity: sql<number>`coalesce(sum(${schema.purchaseOrderItems.quantity}), 0)::int`, // coalesce tránh nhận NULL nếu phép tổng không có giá trị. ::int ép kết quả trả về thành integer để DB driver trả về số thay vì chuỗi
      })
      .from(schema.purchaseOrderItems)
      .innerJoin(
        schema.purchaseOrders,
        eq(schema.purchaseOrderItems.purchaseOrderId, schema.purchaseOrders.id),
      )
      .where(
        and(
          inArray(
            schema.purchaseOrderItems.purchaseRequestItemId,
            requestedIds,
          ),
          inArray(schema.purchaseOrders.status, RESERVED_ORDER_STATUSES),
          ...(excludedOrderId
            ? [ne(schema.purchaseOrders.id, excludedOrderId)]
            : []),
        ),
      )
      .groupBy(schema.purchaseOrderItems.purchaseRequestItemId);
    const reserved = new Map(
      reservations.map((row) => [row.itemId, row.quantity]),
    );

    // Kiểm tra số lượng yêu cầu không được vượt số lượng còn có thể đặt
    for (const input of dto.items) {
      const item = items.find(
        (candidate) => candidate.id === input.purchaseRequestItemId,
      )!;
      const remaining = item.approvedQuantity - (reserved.get(item.id) ?? 0);

      if (input.quantity > remaining) {
        throw new ConflictException(
          `Hạng mục ${item.itemName} chỉ còn có thể đặt ${remaining}.`,
        );
      }
    }

    return { request, revision, items };
  }

  /** Tạo row chi tiết của đơn mua trong bảng `purchase_order_items` */
  private async insertOrderItems(
    db: Database,
    orderId: string,
    dto: SavePurchaseOrderDto,
    items: Awaited<
      ReturnType<PurchaseOrdersService['loadOrderInput']>
    >['items'],
    actorId: string,
  ) {
    await db.insert(schema.purchaseOrderItems).values(
      dto.items.map((input) => {
        const item = items.find(
          (candidate) => candidate.id === input.purchaseRequestItemId,
        )!;
        const totals = calculateOrderLineTotals(
          input.quantity,
          item.unitPriceExclVat,
          item.vatRate,
        );

        return {
          purchaseOrderId: orderId,
          purchaseRequestItemId: item.id,
          selectedQuoteId: item.selectedQuoteId,
          itemNameSnapshot: item.itemName,
          quantity: input.quantity,
          unitPriceExclVat: item.unitPriceExclVat,
          vatRate: item.vatRate,
          ...totals,
          createdBy: actorId,
          updatedBy: actorId,
        };
      }),
    );
  }

  /** Tính lại trạng thái tổng hợp của đề nghị mua sau khi được tạo, duyệt hoặc hủy */
  private async recalculateRequestStatus(
    db: Database,
    requestId: string,
    actorId: string,
  ) {
    // Lấy đề nghị hiện tại
    const request = await this.requireRequest(db, requestId);
    // Lấy phiên bản đơn mua đã duyệt
    const [revision] = await db
      .select({ id: schema.purchaseRequestRevisions.id })
      .from(schema.purchaseRequestRevisions)
      .where(
        and(
          eq(schema.purchaseRequestRevisions.purchaseRequestId, requestId),
          eq(
            schema.purchaseRequestRevisions.revisionNumber,
            request.currentRevision,
          ),
        ),
      );
    // Lấy số lượng được duyệt của từng hạng mục
    const items = await db
      .select({
        id: schema.purchaseRequestItems.id,
        quantity: schema.purchaseRequestItems.quantity,
      })
      .from(schema.purchaseRequestItems)
      .where(eq(schema.purchaseRequestItems.requestRevisionId, revision.id));
    const issued = await db
      .select({
        itemId: schema.purchaseOrderItems.purchaseRequestItemId,
        quantity: sql<number>`coalesce(sum(${schema.purchaseOrderItems.quantity}), 0)::int`,
      })
      .from(schema.purchaseOrderItems)
      .innerJoin(
        schema.purchaseOrders,
        eq(schema.purchaseOrderItems.purchaseOrderId, schema.purchaseOrders.id),
      )
      .where(
        and(
          eq(schema.purchaseOrders.purchaseRequestId, requestId),
          inArray(schema.purchaseOrders.status, ISSUED_ORDER_STATUSES),
        ),
      )
      .groupBy(schema.purchaseOrderItems.purchaseRequestItemId);
    // Kiểm tra có đơn mua đang hoạt động hay không
    const hasActiveOrder = await db
      .select({ id: schema.purchaseOrders.id })
      .from(schema.purchaseOrders)
      .where(
        and(
          eq(schema.purchaseOrders.purchaseRequestId, requestId),
          inArray(schema.purchaseOrders.status, RESERVED_ORDER_STATUSES),
        ),
      )
      .limit(1);
    const issuedByItem = new Map(
      issued.map((row) => [row.itemId, row.quantity]),
    );

    // Suy ra trạng thái đề nghị
    const nextStatus = deriveRequestOrderStatus(
      items.map((item) => ({
        approved: item.quantity,
        issued: issuedByItem.get(item.id) ?? 0,
      })),
      hasActiveOrder.length > 0,
    );

    await db
      .update(schema.purchaseRequests)
      .set({ status: nextStatus, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(schema.purchaseRequests.id, requestId));
  }

  /** Tìm đề nghị mua với status */
  private async requireRequest(
    db: Database,
    id: string,
    statuses?: Array<typeof schema.purchaseRequests.$inferSelect.status>,
  ) {
    const [request] = await db
      .select()
      .from(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.id, id));

    if (!request) throw new NotFoundException('Không tìm thấy đề nghị mua.');

    if (statuses && !statuses.includes(request.status)) {
      throw new ConflictException(
        `Không thể lập đơn mua khi đề nghị ở trạng thái ${request.status}.`,
      );
    }

    return request;
  }

  /** Tìm đơn mua và chặn thao tác nếu trạng thái hiện tại không thuộc status trong `statuses` (nếu có) */
  private async requireOrder(
    db: Database,
    id: string,
    statuses?: PurchaseOrderStatus[],
  ): Promise<PurchaseOrder> {
    const [order] = await db
      .select()
      .from(schema.purchaseOrders)
      .where(eq(schema.purchaseOrders.id, id));

    if (!order) throw new NotFoundException('Không tìm thấy đơn đặt mua.');

    if (statuses && !statuses.includes(order.status)) {
      throw new ConflictException(
        `Không thể thực hiện khi PO ở trạng thái ${order.status}.`,
      );
    }

    return order;
  }

  /** Bảo đảm nhân viên Thu mua chỉ sửa và lập đơn mua do chính mình lập. */
  private assertOrderCreator(
    order: PurchaseOrder,
    actor: AuthenticatedEmployee,
  ): void {
    if (order.createdByEmployeeId !== actor.id) {
      throw new ForbiddenException('Bạn không phải người lập đơn đặt mua này.');
    }
  }

  /** Kết hợp kiểm tra action với phạm vi bắt buộc thuộc phòng PROCUREMENT. */
  private assertProcurementAction(
    actor: AuthenticatedEmployee,
    action: WorkflowAction,
  ): void {
    this.authorization.assertAction(actor, action);
    this.authorization.assertDepartment(actor, 'PROCUREMENT');
  }

  /** Chặn ngày giao dự kiến trước ngày đặt hàng */
  private validateDates(dto: SavePurchaseOrderDto): void {
    if (dto.expectedDeliveryDate < dto.orderDate) {
      throw new BadRequestException(
        'Ngày giao dự kiến không được trước ngày đặt hàng.',
      );
    }
  }

  /** Cộng các snapshot tiền bằng BigInt để không mất chính xác với numeric VND. */
  private sumTotals(
    items: Array<typeof schema.purchaseOrderItems.$inferSelect>,
  ) {
    const sum = (field: 'subtotalExclVat' | 'vatAmount' | 'totalInclVat') =>
      items.reduce((total, item) => total + BigInt(item[field]), 0n).toString();

    return {
      subtotalExclVat: sum('subtotalExclVat'),
      vatAmount: sum('vatAmount'),
      totalInclVat: sum('totalInclVat'),
    };
  }

  /** Trả action kế tiếp ở cấp workflow, không thay thế allowedActions theo actor. */
  private pendingAction(status: PurchaseOrderStatus): WorkflowAction | null {
    if (status === 'draft') return WORKFLOW_ACTIONS.purchaseOrderSubmit;

    if (status === 'pending_procurement_head')
      return WORKFLOW_ACTIONS.purchaseOrderApprove;

    return null;
  }

  /** Tính action UI từ trạng thái, người lập và quyền đã cấu hình của actor. */
  private allowedActions(order: PurchaseOrder, actor: AuthenticatedEmployee) {
    const configured = getAllowedWorkflowActions(
      actor.roleName,
      actor.isDepartmentHead,
      actor.departmentName,
    );
    const candidates: WorkflowAction[] = [];

    if (order.status === 'draft' && order.createdByEmployeeId === actor.id) {
      candidates.push(
        WORKFLOW_ACTIONS.purchaseOrderCreate,
        WORKFLOW_ACTIONS.purchaseOrderSubmit,
      );
    }

    if (order.status === 'pending_procurement_head')
      candidates.push(WORKFLOW_ACTIONS.purchaseOrderApprove);

    if (order.status === 'issued')
      candidates.push(WORKFLOW_ACTIONS.purchaseOrderCancel);

    return candidates.filter((action) => configured.includes(action));
  }

  /** Tìm Trưởng Thu mua và tạo notification */
  private async notifyProcurementHeads(
    db: Database,
    entry: {
      recipientEvent: 'purchase_order_pending_approval';
      order: PurchaseOrder;
      title: string;
      body: string;
    },
  ): Promise<void> {
    const recipients = await db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .innerJoin(
        schema.departments,
        eq(schema.employees.departmentId, schema.departments.id),
      )
      .where(
        and(
          eq(schema.departments.name, 'PROCUREMENT'),
          eq(schema.employees.isDepartmentHead, true),
          eq(schema.employees.isActive, true),
        ),
      );

    await this.notifications.createMany(
      db,
      recipients.map((recipient) => ({
        recipientId: recipient.id,
        eventType: entry.recipientEvent,
        entityType: 'order' as const,
        entityId: entry.order.id,
        title: entry.title,
        body: entry.body,
        metadata: { purchaseRequestId: entry.order.purchaseRequestId },
      })),
    );
  }

  /** Sinh mã đơn mua */
  private createOrderCode(): string {
    const year = new Date().getUTCFullYear();

    return `PO-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}
