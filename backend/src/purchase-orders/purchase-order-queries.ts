import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { RESERVED_ORDER_STATUSES } from './purchase-order-calculations.js';

type Database = NodePgDatabase<typeof schema>;
type PurchaseOrder = typeof schema.purchaseOrders.$inferSelect;
type PurchaseOrderStatus =
  (typeof schema.purchaseOrderStatusEnum.enumValues)[number];

export async function findEligibleRequests(
  authorization: PurchaseAuthorizationService,
  db: Database,
  actor: AuthenticatedEmployee,
) {
  assertProcurementAction(
    authorization,
    actor,
    WORKFLOW_ACTIONS.purchaseOrderCreate,
  );

  const rows = await db.execute(eligibleItemsQuery());

  return rows.rows;
}

function ordersQuery(
  db: Database,
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

  return db
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

export async function findApprovalQueue(
  authorization: PurchaseAuthorizationService,
  db: Database,
  actor: AuthenticatedEmployee,
) {
  assertProcurementAction(
    authorization,
    actor,
    WORKFLOW_ACTIONS.purchaseOrderApprove,
  );

  return findAll(db, actor, { status: 'pending_procurement_head' });
}

export async function findOne(
  audit: RequestAuditService,
  authorization: PurchaseAuthorizationService,
  db: Database,
  id: string,
  actor: AuthenticatedEmployee,
) {
  const [order] = await db
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

  await authorization.assertCanViewRequest(
    order.order.purchaseRequestId,
    actor,
  );

  const items = await db
    .select()
    .from(schema.purchaseOrderItems)
    .where(eq(schema.purchaseOrderItems.purchaseOrderId, id))
    .orderBy(asc(schema.purchaseOrderItems.createdAt));
  const totals = sumTotals(items);
  const timeline = await audit.findTrail(
    'purchase',
    order.order.purchaseRequestId,
  );

  return {
    id,
    status: order.order.status,
    pendingAction: pendingAction(order.order.status),
    allowedActions: allowedActions(order.order, actor),
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

export async function requireRequest(
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

export async function requireOrder(
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

export function sumTotals(
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

export function pendingAction(
  status: PurchaseOrderStatus,
): WorkflowAction | null {
  if (status === 'draft') return WORKFLOW_ACTIONS.purchaseOrderSubmit;

  if (status === 'pending_procurement_head')
    return WORKFLOW_ACTIONS.purchaseOrderApprove;

  if (status === 'issued' || status === 'partially_received')
    return WORKFLOW_ACTIONS.purchaseReceiptRecord;

  return null;
}

export function allowedActions(
  order: PurchaseOrder,
  actor: AuthenticatedEmployee,
) {
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

  if (order.status === 'issued') {
    candidates.push(
      WORKFLOW_ACTIONS.purchaseOrderCancel,
      WORKFLOW_ACTIONS.purchaseReceiptRecord,
      WORKFLOW_ACTIONS.purchaseReceiptCloseShort,
    );
  }

  if (order.status === 'partially_received') {
    candidates.push(
      WORKFLOW_ACTIONS.purchaseReceiptRecord,
      WORKFLOW_ACTIONS.purchaseReceiptCloseShort,
    );
  }

  return candidates.filter((action) => configured.includes(action));
}

export function assertProcurementAction(
  authorization: PurchaseAuthorizationService,
  actor: AuthenticatedEmployee,
  action: WorkflowAction,
): void {
  authorization.assertAction(actor, action);
  authorization.assertDepartment(actor, 'PROCUREMENT');
}

function eligibleItemsQuery() {
  return sql`
      select pr.id, pr.request_code as "requestCode", pr.status,
             pri.id as "itemId", pri.item_name as "itemName",
             pri.quantity,
             (pri.quantity - coalesce(sum(poi.quantity) filter (
               where po.status in (${sql.join(
                 RESERVED_ORDER_STATUSES.map((status) => sql`${status}`),
                 sql`, `,
               )})
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
        where po.status in (${sql.join(
          RESERVED_ORDER_STATUSES.map((status) => sql`${status}`),
          sql`, `,
        )})
      ), 0)
      order by pr.updated_at asc, pri.sort_order asc
    `;
}

export async function countEligibleRequests(
  authorization: PurchaseAuthorizationService,
  db: Database,
  actor: AuthenticatedEmployee,
) {
  assertProcurementAction(
    authorization,
    actor,
    WORKFLOW_ACTIONS.purchaseOrderCreate,
  );
  const result = await db.execute<{ value: number }>(
    sql`select count(*)::int as value from (${eligibleItemsQuery()}) as eligible`,
  );

  return result.rows[0]?.value ?? 0;
}

export async function findAll(
  db: Database,
  actor: AuthenticatedEmployee,
  filters: { requestId?: string; supplierId?: string; status?: string },
) {
  return ordersQuery(db, actor, filters);
}

export async function countApprovalQueue(
  authorization: PurchaseAuthorizationService,
  db: Database,
  actor: AuthenticatedEmployee,
) {
  assertProcurementAction(
    authorization,
    actor,
    WORKFLOW_ACTIONS.purchaseOrderApprove,
  );

  return db.$count(
    ordersQuery(db, actor, { status: 'pending_procurement_head' }).as(
      'approval_queue',
    ),
  );
}

export async function countOrderTasks(
  db: Database,
  actor: AuthenticatedEmployee,
) {
  const orders = ordersQuery(db, actor, {}).as('visible_orders');
  const [draft, ongoing] = await Promise.all([
    db.$count(orders, eq(orders.status, 'draft')),
    db.$count(
      orders,
      or(eq(orders.status, 'issued'), eq(orders.status, 'partially_received')),
    ),
  ]);

  return { draft, ongoing };
}
