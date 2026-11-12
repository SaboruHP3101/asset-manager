import { ConflictException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { requireAllocationContext } from './allocation-context.js';
import { findOwnerRecipients } from './allocation-notifications.js';
import { AssetAllocationDecisionDto } from './dto/asset-allocation.dto.js';

type Database = NodePgDatabase<typeof schema>;
type DecisionParty = 'department' | 'recipient';

export function allocationOutcome(
  departmentDecision: string,
  recipientDecision: string | null,
): 'pending_confirmations' | 'rejected' | 'confirmed' {
  if (departmentDecision === 'rejected' || recipientDecision === 'rejected') {
    return 'rejected';
  }

  if (
    departmentDecision === 'confirmed' &&
    (recipientDecision === null || recipientDecision === 'confirmed')
  ) {
    return 'confirmed';
  }

  return 'pending_confirmations';
}
export async function applyDecision(
  audit: RequestAuditService,
  notifications: NotificationsService,
  tx: Database,
  allocation: Awaited<ReturnType<typeof requireAllocationContext>>,
  dto: AssetAllocationDecisionDto,
  actor: AuthenticatedEmployee,
  party: DecisionParty,
) {
  const currentDecision =
    party === 'department'
      ? allocation.departmentHeadDecision
      : allocation.recipientDecision;

  if (currentDecision !== 'pending') {
    throw new ConflictException('Bạn đã xác nhận lần cấp phát này.');
  }

  const now = new Date();
  const decision = dto.confirmed ? 'confirmed' : 'rejected';

  await tx
    .update(schema.assetAllocations)
    .set(
      party === 'department'
        ? {
            departmentHeadDecision: decision,
            departmentHeadDecidedBy: actor.id,
            departmentHeadDecidedAt: now,
            departmentHeadNote: dto.reason?.trim() ?? null,
            updatedAt: now,
            updatedBy: actor.id,
          }
        : {
            recipientDecision: decision,
            recipientDecidedAt: now,
            recipientNote: dto.reason?.trim() ?? null,
            updatedAt: now,
            updatedBy: actor.id,
          },
    )
    .where(eq(schema.assetAllocations.id, allocation.id));

  const outcome = allocationOutcome(
    party === 'department' ? decision : allocation.departmentHeadDecision,
    party === 'recipient' ? decision : allocation.recipientDecision,
  );

  if (outcome === 'rejected') {
    await rejectAllocation(
      audit,
      notifications,
      tx,
      allocation,
      actor,
      dto.reason!,
      now,
    );
  } else if (outcome === 'confirmed') {
    await activateAsset(audit, notifications, tx, allocation, actor, now);
  } else {
    await auditDecision(audit, tx, allocation, actor, {
      actionType: 'purchase.allocation.confirm_' + party,
      result: 'approved',
      party,
      newStatus: 'pending_confirmations',
    });
  }
}

export async function rejectAllocation(
  audit: RequestAuditService,
  notifications: NotificationsService,
  tx: Database,
  allocation: Awaited<ReturnType<typeof requireAllocationContext>>,
  actor: AuthenticatedEmployee,
  reason: string,
  now: Date,
) {
  await tx
    .update(schema.assetAllocations)
    .set({ status: 'rejected', updatedAt: now, updatedBy: actor.id })
    .where(eq(schema.assetAllocations.id, allocation.id));
  await tx
    .update(schema.assets)
    .set({
      status: 'awaiting_reallocation',
      currentUserId: null,
      currentManagingDepartmentId: null,
      currentLocation: null,
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.assets.id, allocation.assetId));
  await auditDecision(audit, tx, allocation, actor, {
    actionType: 'purchase.allocation.reject',
    result: 'rejected',
    newStatus: 'awaiting_reallocation',
    reason,
  });

  const ownerRecipients = await findOwnerRecipients(
    tx,
    allocation.managementOwner,
  );

  await notifications.createMany(tx, [
    ...ownerRecipients.map((recipientId) => ({
      recipientId,
      eventType: 'asset_pending_reallocation' as const,
      entityType: 'asset' as const,
      entityId: allocation.assetId,
      title: 'Tài sản chờ phân bổ lại',
      body: `${allocation.assetCode} bị từ chối cấp phát: ${reason}`,
      metadata: { allocationId: allocation.id },
    })),
    ...[...new Set([allocation.initiatedBy, allocation.recipientId])]
      .filter((recipientId): recipientId is string => recipientId !== null)
      .map((recipientId) => ({
        recipientId,
        eventType: 'asset_allocation_rejected' as const,
        entityType: 'allocation' as const,
        entityId: allocation.id,
        title: 'Cấp phát bị từ chối',
        body: `${allocation.assetCode} bị từ chối cấp phát: ${reason}`,
        metadata: { assetId: allocation.assetId },
      })),
  ]);
}

export async function activateAsset(
  audit: RequestAuditService,
  notifications: NotificationsService,
  tx: Database,
  allocation: Awaited<ReturnType<typeof requireAllocationContext>>,
  actor: AuthenticatedEmployee,
  now: Date,
) {
  await tx
    .update(schema.assetAllocations)
    .set({ status: 'confirmed', updatedAt: now, updatedBy: actor.id })
    .where(eq(schema.assetAllocations.id, allocation.id));
  await tx
    .update(schema.assets)
    .set({
      status: 'active',
      currentUserId:
        allocation.targetType === 'individual' ? allocation.recipientId : null,
      currentManagingDepartmentId: allocation.departmentId,
      currentLocation: allocation.location,
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.assets.id, allocation.assetId));
  await tx.insert(schema.assetHandoverHistory).values({
    assetId: allocation.assetId,
    handoverType:
      allocation.attemptNumber === 1 ? 'initial_allocation' : 'reallocation',
    receivedByEmployeeId:
      allocation.targetType === 'individual' ? allocation.recipientId : null,
    receivedByDepartmentId: allocation.departmentId,
    handoverDate: now.toISOString().slice(0, 10),
    status: 'completed',
    note: `Allocation ${allocation.id}: ${allocation.location}`,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await auditDecision(audit, tx, allocation, actor, {
    actionType: 'purchase.allocation.activate',
    result: 'approved',
    newStatus: 'active',
  });
  const [ownerRecipients, departmentHeads] = await Promise.all([
    findOwnerRecipients(tx, allocation.managementOwner),
    tx
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .where(
        and(
          eq(schema.employees.departmentId, allocation.departmentId),
          eq(schema.employees.isDepartmentHead, true),
          eq(schema.employees.isActive, true),
        ),
      ),
  ]);
  const recipients = [
    ...new Set([
      allocation.recipientId,
      allocation.initiatedBy,
      ...ownerRecipients,
      ...departmentHeads.map((head) => head.id),
    ]),
  ].filter((recipientId): recipientId is string => recipientId !== null);

  await notifications.createMany(
    tx,
    recipients.map((recipientId) => ({
      recipientId,
      eventType: 'asset_activated' as const,
      entityType: 'asset' as const,
      entityId: allocation.assetId,
      title: 'Tài sản đã kích hoạt',
      body: `${allocation.assetCode} đã hoàn tất xác nhận và được kích hoạt.`,
      metadata: { allocationId: allocation.id },
    })),
  );
}

export function auditDecision(
  audit: RequestAuditService,
  tx: Database,
  allocation: Awaited<ReturnType<typeof requireAllocationContext>>,
  actor: AuthenticatedEmployee,
  entry: {
    actionType: string;
    result: 'approved' | 'rejected';
    party?: DecisionParty;
    newStatus: string;
    reason?: string;
  },
) {
  const { actionType, result, party, newStatus, reason } = entry;

  return audit.logPurchase(tx, {
    requestId: allocation.requestId,
    revision: allocation.requestRevision,
    actionType,
    actor,
    result,
    previousStatus: allocation.assetStatus,
    newStatus,
    reason,
    entityType: 'allocation',
    entityId: allocation.id,
    metadata: { assetId: allocation.assetId, party },
  });
}
