import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

type Database = NodePgDatabase<typeof schema>;

export async function notifyDepartmentHeads(
  notifications: NotificationsService,
  db: Database,
  departmentId: string,
  entry: {
    eventType: 'purchase_request_submitted';
    requestId: string;
    title: string;
    body: string;
  },
) {
  const recipients = await db
    .select({ id: schema.employees.id })
    .from(schema.employees)
    .where(
      and(
        eq(schema.employees.departmentId, departmentId),
        eq(schema.employees.isDepartmentHead, true),
        eq(schema.employees.isActive, true),
      ),
    );

  await notifications.createMany(
    db,
    recipients.map((recipient) => ({
      recipientId: recipient.id,
      eventType: entry.eventType,
      entityType: 'request' as const,
      entityId: entry.requestId,
      title: entry.title,
      body: entry.body,
    })),
  );
}

export async function notifyDepartment(
  notifications: NotificationsService,
  db: Database,
  departmentName: string,
  entry: {
    eventType: 'purchase_request_ready_for_procurement';
    requestId: string;
    title: string;
    body: string;
  },
) {
  const recipients = await departmentRecipients(db, departmentName, false);

  await notifications.createMany(
    db,
    recipients.map((recipient) => ({
      recipientId: recipient.id,
      eventType: entry.eventType,
      entityType: 'request' as const,
      entityId: entry.requestId,
      title: entry.title,
      body: entry.body,
    })),
  );
}

export async function notifyDepartmentHeadsByName(
  notifications: NotificationsService,
  db: Database,
  departmentName: string,
  entry: {
    eventType:
      | 'purchase_request_ready_for_procurement_head'
      | 'purchase_request_ready_for_it_head';
    requestId: string;
    title: string;
    body: string;
  },
) {
  const recipients = await departmentRecipients(db, departmentName, true);

  await notifications.createMany(
    db,
    recipients.map((recipient) => ({
      recipientId: recipient.id,
      eventType: entry.eventType,
      entityType: 'request' as const,
      entityId: entry.requestId,
      title: entry.title,
      body: entry.body,
    })),
  );
}

function departmentRecipients(
  db: Database,
  departmentName: string,
  headsOnly: boolean,
) {
  return db
    .select({ id: schema.employees.id })
    .from(schema.employees)
    .innerJoin(
      schema.departments,
      eq(schema.employees.departmentId, schema.departments.id),
    )
    .where(
      and(
        eq(schema.departments.name, departmentName),
        eq(schema.employees.isActive, true),
        ...(headsOnly ? [eq(schema.employees.isDepartmentHead, true)] : []),
      ),
    );
}

export function notifyRequesterApproved(
  notifications: NotificationsService,
  db: Database,
  request: typeof schema.purchaseRequests.$inferSelect,
) {
  return notifications.create(db, {
    recipientId: request.requesterId,
    eventType: 'purchase_request_approved',
    entityType: 'request',
    entityId: request.id,
    title: 'Đề nghị mua đã được duyệt',
    body: `${request.requestCode} đã hoàn tất phê duyệt.`,
    metadata: { revision: request.currentRevision },
  });
}
