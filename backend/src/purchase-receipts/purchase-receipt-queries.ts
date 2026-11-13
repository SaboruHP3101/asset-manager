import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
} from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import {
  calculateReceiptProgress,
  type ReceiptProgressLine,
} from './purchase-receipt-calculations.js';

type Database = NodePgDatabase<typeof schema>;
type ManagementOwner =
  (typeof schema.assetManagementOwnerEnum.enumValues)[number];

function findInspectionQueueQuery(
  authorization: PurchaseAuthorizationService,
  db: Database,
  actor: AuthenticatedEmployee,
) {
  const owner = inspectionOwner(authorization, actor);

  return db
    .select({
      unitId: schema.purchaseReceiptUnits.id,
      receiptId: schema.purchaseReceipts.id,
      receiptCode: schema.purchaseReceipts.receiptCode,
      deliveryDate: schema.purchaseReceipts.deliveryDate,
      purchaseOrderId: schema.purchaseOrders.id,
      purchaseOrderCode: schema.purchaseOrders.purchaseOrderCode,
      itemName: schema.purchaseOrderItems.itemNameSnapshot,
      trackingMode: schema.purchaseReceiptItems.trackingModeSnapshot,
      sequenceNumber: schema.purchaseReceiptUnits.sequenceNumber,
      serialNumber: schema.purchaseReceiptUnits.serialNumber,
    })
    .from(schema.purchaseReceiptUnits)
    .innerJoin(
      schema.purchaseReceiptItems,
      eq(
        schema.purchaseReceiptUnits.purchaseReceiptItemId,
        schema.purchaseReceiptItems.id,
      ),
    )
    .innerJoin(
      schema.purchaseReceipts,
      eq(
        schema.purchaseReceiptItems.purchaseReceiptId,
        schema.purchaseReceipts.id,
      ),
    )
    .innerJoin(
      schema.purchaseOrderItems,
      eq(
        schema.purchaseReceiptItems.purchaseOrderItemId,
        schema.purchaseOrderItems.id,
      ),
    )
    .innerJoin(
      schema.purchaseOrders,
      eq(schema.purchaseOrderItems.purchaseOrderId, schema.purchaseOrders.id),
    )
    .where(
      and(
        eq(schema.purchaseReceiptUnits.inspectionResult, 'pending'),
        eq(schema.purchaseReceiptItems.managementOwnerSnapshot, owner),
      ),
    )
    .orderBy(
      asc(schema.purchaseReceipts.createdAt),
      asc(schema.purchaseReceiptItems.createdAt),
      asc(schema.purchaseReceiptUnits.sequenceNumber),
    );
}

export async function findOrderProgress(
  authorization: PurchaseAuthorizationService,
  db: Database,
  orderId: string,
  actor: AuthenticatedEmployee,
) {
  const context = await requireOrderContext(db, orderId, [
    'issued',
    'partially_received',
    'fully_received',
    'closed_short',
  ]);

  await authorization.assertCanViewRequest(context.purchaseRequestId, actor);
  const items = await loadOrderItems(db, orderId);
  const progress = await loadOrderProgress(db, items);

  return items.map((item) => ({
    purchaseOrderItemId: item.id,
    itemName: item.itemNameSnapshot,
    trackingMode: item.trackingModeSnapshot,
    managementOwner: item.managementOwnerSnapshot,
    ...progress.get(item.id),
  }));
}

export async function findOne(
  authorization: PurchaseAuthorizationService,
  db: Database,
  id: string,
  actor: AuthenticatedEmployee,
) {
  const [receipt] = await db
    .select({
      receipt: schema.purchaseReceipts,
      purchaseRequestId: schema.purchaseOrders.purchaseRequestId,
      purchaseOrderCode: schema.purchaseOrders.purchaseOrderCode,
    })
    .from(schema.purchaseReceipts)
    .innerJoin(
      schema.purchaseOrders,
      eq(schema.purchaseReceipts.purchaseOrderId, schema.purchaseOrders.id),
    )
    .where(eq(schema.purchaseReceipts.id, id));

  if (!receipt) throw new NotFoundException('Không tìm thấy đợt giao hàng.');

  await authorization.assertCanViewRequest(receipt.purchaseRequestId, actor);

  const items = await db
    .select({
      id: schema.purchaseReceiptItems.id,
      itemName: schema.purchaseOrderItems.itemNameSnapshot,
      deliveredQuantity: schema.purchaseReceiptItems.deliveredQuantity,
      acceptedQuantity: schema.purchaseReceiptItems.acceptedQuantity,
      rejectedQuantity: schema.purchaseReceiptItems.rejectedQuantity,
      managementOwner: schema.purchaseReceiptItems.managementOwnerSnapshot,
      trackingMode: schema.purchaseReceiptItems.trackingModeSnapshot,
    })
    .from(schema.purchaseReceiptItems)
    .innerJoin(
      schema.purchaseOrderItems,
      eq(
        schema.purchaseReceiptItems.purchaseOrderItemId,
        schema.purchaseOrderItems.id,
      ),
    )
    .where(eq(schema.purchaseReceiptItems.purchaseReceiptId, id));

  return {
    id,
    status: receipt.receipt.status,
    allowedActions: allowedReceiptActions(actor),
    data: {
      ...receipt.receipt,
      purchaseOrderCode: receipt.purchaseOrderCode,
      items: items.map((item) => ({
        ...item,
        pendingQuantity:
          item.deliveredQuantity -
          item.acceptedQuantity -
          item.rejectedQuantity,
      })),
    },
  };
}

export async function loadOrderItems(db: Database, orderId: string) {
  return db
    .select({
      id: schema.purchaseOrderItems.id,
      purchaseRequestItemId: schema.purchaseOrderItems.purchaseRequestItemId,
      itemNameSnapshot: schema.purchaseOrderItems.itemNameSnapshot,
      quantity: schema.purchaseOrderItems.quantity,
      unitPriceExclVat: schema.purchaseOrderItems.unitPriceExclVat,
      assetCategoryId: schema.purchaseRequestItems.assetCategoryId,
      managementOwnerSnapshot:
        schema.purchaseRequestItems.managementOwnerSnapshot,
      trackingModeSnapshot: schema.purchaseRequestItems.trackingModeSnapshot,
    })
    .from(schema.purchaseOrderItems)
    .innerJoin(
      schema.purchaseRequestItems,
      eq(
        schema.purchaseOrderItems.purchaseRequestItemId,
        schema.purchaseRequestItems.id,
      ),
    )
    .where(eq(schema.purchaseOrderItems.purchaseOrderId, orderId));
}

export async function loadOrderProgress(
  db: Database,
  items: Awaited<ReturnType<typeof loadOrderItems>>,
) {
  if (items.length === 0) return new Map<string, ReceiptProgressLine>();

  const rows = await db
    .select({
      purchaseOrderItemId: schema.purchaseReceiptItems.purchaseOrderItemId,
      delivered: sql<number>`coalesce(sum(${schema.purchaseReceiptItems.deliveredQuantity}), 0)::int`,
      accepted: sql<number>`coalesce(sum(${schema.purchaseReceiptItems.acceptedQuantity}), 0)::int`,
      rejected: sql<number>`coalesce(sum(${schema.purchaseReceiptItems.rejectedQuantity}), 0)::int`,
    })
    .from(schema.purchaseReceiptItems)
    .where(
      inArray(
        schema.purchaseReceiptItems.purchaseOrderItemId,
        items.map((item) => item.id),
      ),
    )
    .groupBy(schema.purchaseReceiptItems.purchaseOrderItemId);
  const totals = new Map(rows.map((row) => [row.purchaseOrderItemId, row]));

  return new Map(
    items.map((item) => {
      const total = totals.get(item.id);

      return [
        item.id,
        calculateReceiptProgress(
          item.quantity,
          total?.delivered ?? 0,
          total?.accepted ?? 0,
          total?.rejected ?? 0,
        ),
      ];
    }),
  );
}

export async function requireOrderContext(
  db: Database,
  orderId: string,
  statuses: Array<typeof schema.purchaseOrders.$inferSelect.status>,
) {
  const [order] = await db
    .select({
      id: schema.purchaseOrders.id,
      status: schema.purchaseOrders.status,
      purchaseRequestId: schema.purchaseOrders.purchaseRequestId,
      requestRevision: schema.purchaseRequestRevisions.revisionNumber,
      supplierId: schema.purchaseOrders.supplierId,
    })
    .from(schema.purchaseOrders)
    .innerJoin(
      schema.purchaseRequestRevisions,
      eq(
        schema.purchaseOrders.requestRevisionId,
        schema.purchaseRequestRevisions.id,
      ),
    )
    .where(eq(schema.purchaseOrders.id, orderId));

  if (!order) throw new NotFoundException('Không tìm thấy đơn đặt mua.');

  if (!statuses.includes(order.status)) {
    throw new ConflictException('Trạng thái PO không cho phép thao tác này.');
  }

  return order;
}

export async function requireUnitContext(db: Database, unitId: string) {
  const [context] = await db
    .select({
      inspectionResult: schema.purchaseReceiptUnits.inspectionResult,
      purchaseReceiptItemId: schema.purchaseReceiptItems.id,
      managementOwnerSnapshot:
        schema.purchaseReceiptItems.managementOwnerSnapshot,
      trackingModeSnapshot: schema.purchaseReceiptItems.trackingModeSnapshot,
      receiptId: schema.purchaseReceipts.id,
      receiptCode: schema.purchaseReceipts.receiptCode,
      receiptStatus: schema.purchaseReceipts.status,
      deliveryDate: schema.purchaseReceipts.deliveryDate,
      recordedBy: schema.purchaseReceipts.recordedBy,
      purchaseOrderId: schema.purchaseOrders.id,
      purchaseRequestId: schema.purchaseOrders.purchaseRequestId,
      requestRevision: schema.purchaseRequestRevisions.revisionNumber,
      supplierId: schema.purchaseOrders.supplierId,
      orderDate: schema.purchaseOrders.orderDate,
      purchaseOrderItemId: schema.purchaseOrderItems.id,
      itemNameSnapshot: schema.purchaseOrderItems.itemNameSnapshot,
      unitPriceExclVat: schema.purchaseOrderItems.unitPriceExclVat,
      assetCategoryId: schema.purchaseRequestItems.assetCategoryId,
      requestDepartmentId: schema.purchaseRequests.departmentId,
    })
    .from(schema.purchaseReceiptUnits)
    .innerJoin(
      schema.purchaseReceiptItems,
      eq(
        schema.purchaseReceiptUnits.purchaseReceiptItemId,
        schema.purchaseReceiptItems.id,
      ),
    )
    .innerJoin(
      schema.purchaseReceipts,
      eq(
        schema.purchaseReceiptItems.purchaseReceiptId,
        schema.purchaseReceipts.id,
      ),
    )
    .innerJoin(
      schema.purchaseOrderItems,
      eq(
        schema.purchaseReceiptItems.purchaseOrderItemId,
        schema.purchaseOrderItems.id,
      ),
    )
    .innerJoin(
      schema.purchaseRequestItems,
      eq(
        schema.purchaseOrderItems.purchaseRequestItemId,
        schema.purchaseRequestItems.id,
      ),
    )
    .innerJoin(
      schema.purchaseOrders,
      eq(schema.purchaseOrderItems.purchaseOrderId, schema.purchaseOrders.id),
    )
    .innerJoin(
      schema.purchaseRequestRevisions,
      eq(
        schema.purchaseOrders.requestRevisionId,
        schema.purchaseRequestRevisions.id,
      ),
    )
    .innerJoin(
      schema.purchaseRequests,
      eq(schema.purchaseOrders.purchaseRequestId, schema.purchaseRequests.id),
    )
    .where(eq(schema.purchaseReceiptUnits.id, unitId));

  if (!context) throw new NotFoundException('Không tìm thấy đơn vị kiểm tra.');

  return context;
}

export function allowedReceiptActions(actor: AuthenticatedEmployee) {
  const actions = getAllowedWorkflowActions(
    actor.roleName,
    actor.isDepartmentHead,
    actor.departmentName,
  );

  return actions.filter((action) => action.startsWith('purchase.receipt.'));
}

export function inspectionOwner(
  authorization: PurchaseAuthorizationService,
  actor: AuthenticatedEmployee,
): ManagementOwner {
  const action =
    actor.departmentName === 'IT'
      ? WORKFLOW_ACTIONS.purchaseReceiptInspectIt
      : WORKFLOW_ACTIONS.purchaseReceiptInspectProcurement;

  authorization.assertAction(actor, action);

  if (actor.departmentName === 'IT') return 'it';

  if (actor.departmentName === 'PROCUREMENT') return 'procurement';

  throw new ForbiddenException('Không thuộc bộ phận kiểm tra tài sản.');
}

export function lockOrder(db: Database, orderId: string) {
  return db.execute(
    sql`select id from purchase_orders where id = ${orderId} for update`,
  );
}

export async function findInspectionQueue(
  authorization: PurchaseAuthorizationService,
  db: Database,
  actor: AuthenticatedEmployee,
) {
  return findInspectionQueueQuery(authorization, db, actor);
}

export async function countInspectionQueue(
  authorization: PurchaseAuthorizationService,
  db: Database,
  actor: AuthenticatedEmployee,
) {
  return db.$count(
    findInspectionQueueQuery(authorization, db, actor).as('queue'),
  );
}
