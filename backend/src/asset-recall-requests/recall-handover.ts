import { BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { requireActiveItWarehouse } from '../warehouses/warehouses.service.js';
import { RecallHandoverDecisionDto } from './dto/asset-recall-request.dto.js';
import {
  handoverSide,
  lockAsset,
  lockRequest,
  logAction,
  releaseReplacement,
  requireOwnedItAsset,
  requireRequest,
  requireReservedReplacement,
} from './recall-context.js';

type Database = NodePgDatabase<typeof schema>;
type RecallRecord = typeof schema.assetRecallRequests.$inferSelect;
export async function decideHandover(
  audit: RequestAuditService,
  db: Database,
  id: string,
  dto: RecallHandoverDecisionDto,
  actor: AuthenticatedEmployee,
) {
  await db.transaction(async (tx) => {
    await lockRequest(tx, id);
    const request = await requireRequest(tx, id, [
      'pending_handover_confirmations',
    ]);
    const side = handoverSide(request, actor);
    const now = new Date();
    const decision = dto.confirmed
      ? ('confirmed' as const)
      : ('rejected' as const);
    const note = dto.reason?.trim() || null;
    const decisionFields =
      side === 'employee'
        ? {
            employeeHandoverDecision: decision,
            employeeHandoverDecidedAt: now,
            employeeHandoverNote: note,
          }
        : {
            itHandoverDecision: decision,
            itHandoverDecidedBy: actor.id,
            itHandoverDecidedAt: now,
            itHandoverNote: note,
          };

    if (!dto.confirmed) {
      if (request.replacementAssetId) {
        await lockAsset(tx, request.replacementAssetId);
        await releaseReplacement(tx, request.replacementAssetId, actor.id);
      }

      await tx
        .update(schema.assetRecallRequests)
        .set({
          status: 'revision_required',
          replacementAssetId: null,
          ...decisionFields,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.assetRecallRequests.id, id));
      await logAction(audit, tx, id, actor, {
        actionType: `asset.recall.${side}_handover_rejected`,
        result: 'rejected',
        previousStatus: request.status,
        newStatus: 'revision_required',
        reason: dto.reason,
        revision: request.currentRevision,
      });

      return;
    }

    const [updated] = await tx
      .update(schema.assetRecallRequests)
      .set({
        ...decisionFields,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assetRecallRequests.id, id))
      .returning();

    await logAction(audit, tx, id, actor, {
      actionType: `asset.recall.${side}_handover_confirmed`,
      result: 'approved',
      previousStatus: request.status,
      newStatus: request.status,
      revision: request.currentRevision,
    });

    if (
      updated.employeeHandoverDecision === 'confirmed' &&
      updated.itHandoverDecision === 'confirmed'
    ) {
      if (updated.type === 'disposal') {
        await receiveDisposal(audit, tx, updated, actor, now);
      } else if (updated.type === 'upgrade') {
        await receiveUpgrade(audit, tx, updated, actor, now);
      } else {
        await completeExchange(audit, tx, updated, actor, now);
      }
    }
  });
}

export async function receiveDisposal(
  audit: RequestAuditService,
  tx: Database,
  request: RecallRecord,
  actor: AuthenticatedEmployee,
  now: Date,
) {
  await lockAsset(tx, request.assetId);
  const warehouse = await requireActiveItWarehouse(tx);
  const asset = await requireOwnedItAsset(
    tx,
    request.assetId,
    request.requestedBy,
  );

  // Chỉ đổi custody sau khi cả hai phía xác nhận bàn giao thực tế.
  await tx
    .update(schema.assets)
    .set({
      status: 'awaiting_disposal',
      currentUserId: null,
      currentManagingDepartmentId: warehouse.managingDepartmentId,
      currentWarehouseId: warehouse.id,
      currentLocation: warehouse.location,
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.assets.id, asset.id));
  await tx.insert(schema.assetHandoverHistory).values({
    assetId: asset.id,
    handoverType: 'recall_to_it_warehouse',
    handoverFromEmployeeId: request.requestedBy,
    handoverFromDepartmentId: request.requestingDepartmentId,
    receivedByDepartmentId: warehouse.managingDepartmentId,
    receivedByWarehouseId: warehouse.id,
    handoverDate: now.toISOString().slice(0, 10),
    status: 'completed',
    note: `Recall request ${request.id}`,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await tx
    .update(schema.assetRecallRequests)
    .set({
      status: 'in_progress',
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.assetRecallRequests.id, request.id));
  await logAction(audit, tx, request.id, actor, {
    actionType: 'asset.recall.disposal_received',
    result: 'approved',
    previousStatus: request.status,
    newStatus: 'in_progress',
    revision: request.currentRevision,
  });
}

export async function receiveUpgrade(
  audit: RequestAuditService,
  tx: Database,
  request: RecallRecord,
  actor: AuthenticatedEmployee,
  now: Date,
) {
  await lockAsset(tx, request.assetId);
  const warehouse = await requireActiveItWarehouse(tx);
  const asset = await requireOwnedItAsset(
    tx,
    request.assetId,
    request.requestedBy,
  );

  await tx
    .update(schema.assets)
    .set({
      status: 'upgrading',
      currentUserId: null,
      currentManagingDepartmentId: warehouse.managingDepartmentId,
      currentWarehouseId: warehouse.id,
      currentLocation: warehouse.location,
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.assets.id, asset.id));
  await tx.insert(schema.assetHandoverHistory).values({
    assetId: asset.id,
    handoverType: 'recall_to_it_warehouse',
    handoverFromEmployeeId: request.requestedBy,
    handoverFromDepartmentId: request.requestingDepartmentId,
    receivedByDepartmentId: warehouse.managingDepartmentId,
    receivedByWarehouseId: warehouse.id,
    handoverDate: now.toISOString().slice(0, 10),
    status: 'completed',
    note: `Recall request ${request.id}`,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await tx
    .update(schema.assetRecallRequests)
    .set({ status: 'in_progress', updatedAt: now, updatedBy: actor.id })
    .where(eq(schema.assetRecallRequests.id, request.id));
  await logAction(audit, tx, request.id, actor, {
    actionType: 'asset.recall.upgrade_received',
    result: 'approved',
    previousStatus: request.status,
    newStatus: 'in_progress',
    revision: request.currentRevision,
  });
}

export async function completeExchange(
  audit: RequestAuditService,
  tx: Database,
  request: RecallRecord,
  actor: AuthenticatedEmployee,
  now: Date,
) {
  if (!request.replacementAssetId) {
    throw new BadRequestException('Phiếu chưa có tài sản thay thế.');
  }

  await lockAsset(tx, request.assetId);
  await lockAsset(tx, request.replacementAssetId);
  const warehouse = await requireActiveItWarehouse(tx);
  const original = await requireOwnedItAsset(
    tx,
    request.assetId,
    request.requestedBy,
  );
  const replacement = await requireReservedReplacement(
    tx,
    request.replacementAssetId,
    warehouse.id,
  );

  await tx
    .update(schema.assets)
    .set({
      status: 'available',
      currentUserId: null,
      currentManagingDepartmentId: warehouse.managingDepartmentId,
      currentWarehouseId: warehouse.id,
      currentLocation: warehouse.location,
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.assets.id, original.id));
  await tx
    .update(schema.assets)
    .set({
      status: 'active',
      currentUserId: request.requestedBy,
      currentManagingDepartmentId: request.requestingDepartmentId,
      currentWarehouseId: null,
      currentLocation: request.originalLocation,
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.assets.id, replacement.id));
  await tx.insert(schema.assetHandoverHistory).values([
    {
      assetId: original.id,
      handoverType: 'recall_to_it_warehouse',
      handoverFromEmployeeId: request.requestedBy,
      handoverFromDepartmentId: request.requestingDepartmentId,
      receivedByDepartmentId: warehouse.managingDepartmentId,
      receivedByWarehouseId: warehouse.id,
      handoverDate: now.toISOString().slice(0, 10),
      status: 'completed',
      note: `Recall request ${request.id}`,
      createdBy: actor.id,
      updatedBy: actor.id,
    },
    {
      assetId: replacement.id,
      handoverType: 'exchange_issued',
      handoverFromDepartmentId: warehouse.managingDepartmentId,
      handoverFromWarehouseId: warehouse.id,
      receivedByEmployeeId: request.requestedBy,
      receivedByDepartmentId: request.requestingDepartmentId,
      handoverDate: now.toISOString().slice(0, 10),
      status: 'completed',
      note: `Recall request ${request.id}`,
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  ]);
  await tx
    .update(schema.assetRecallRequests)
    .set({
      status: 'completed',
      completedAt: now,
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.assetRecallRequests.id, request.id));
  await logAction(audit, tx, request.id, actor, {
    actionType: 'asset.recall.exchange_completed',
    result: 'approved',
    previousStatus: request.status,
    newStatus: 'completed',
    revision: request.currentRevision,
    metadata: { replacementAssetId: replacement.id },
  });
}
