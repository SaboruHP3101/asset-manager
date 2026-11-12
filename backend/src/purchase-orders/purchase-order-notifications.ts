import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

type Database = NodePgDatabase<typeof schema>;
type PurchaseOrder = typeof schema.purchaseOrders.$inferSelect;

export async function notifyProcurementHeads(
  notifications: NotificationsService,
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

  await notifications.createMany(
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
