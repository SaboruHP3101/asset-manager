import { and, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import {
  deriveRequestOrderStatus,
  ISSUED_ORDER_STATUSES,
  RESERVED_ORDER_STATUSES,
} from './purchase-order-calculations.js';
import { requireRequest } from './purchase-order-queries.js';

type Database = NodePgDatabase<typeof schema>;
export async function recalculateRequestStatus(
  db: Database,
  requestId: string,
  actorId: string,
) {
  // Lấy đề nghị hiện tại
  const request = await requireRequest(db, requestId);
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
  const issuedByItem = new Map(issued.map((row) => [row.itemId, row.quantity]));

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
