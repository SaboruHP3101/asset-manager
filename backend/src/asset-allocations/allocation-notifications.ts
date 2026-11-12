import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

type Database = NodePgDatabase<typeof schema>;
type ManagementOwner =
  (typeof schema.assetManagementOwnerEnum.enumValues)[number];

export async function notifyPendingConfirmations(
  notifications: NotificationsService,
  tx: Database,
  allocationId: string,
  assetCode: string,
  departmentId: string,
  recipientId: string | null,
) {
  const heads = await tx
    .select({ id: schema.employees.id })
    .from(schema.employees)
    .where(
      and(
        eq(schema.employees.departmentId, departmentId),
        eq(schema.employees.isDepartmentHead, true),
        eq(schema.employees.isActive, true),
      ),
    );
  const recipients = [
    ...new Set([recipientId, ...heads.map((head) => head.id)]),
  ].filter((id): id is string => id !== null);

  await notifications.createMany(
    tx,
    recipients.map((id) => ({
      recipientId: id,
      eventType: 'asset_allocation_pending_confirmation' as const,
      entityType: 'allocation' as const,
      entityId: allocationId,
      title: 'Cấp phát chờ xác nhận',
      body: `${assetCode} đang chờ xác nhận cấp phát.`,
      metadata: { assetCode },
    })),
  );
}

export async function findOwnerRecipients(
  db: Database,
  owner: ManagementOwner,
) {
  const rows = await db
    .select({ id: schema.employees.id })
    .from(schema.employees)
    .innerJoin(
      schema.departments,
      eq(schema.employees.departmentId, schema.departments.id),
    )
    .where(
      and(
        eq(schema.departments.name, owner.toUpperCase()),
        eq(schema.employees.isActive, true),
      ),
    );

  return rows.map((row) => row.id);
}
