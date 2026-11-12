import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { requireActiveItWarehouse } from '../warehouses/warehouses.service.js';
import {
  CompleteDisposalDto,
  CompleteUpgradeDto,
  RecallHandoverDecisionDto,
} from './dto/asset-recall-request.dto.js';
import {
  assertItHead,
  loadAsset,
  lockAsset,
  lockRequest,
  logAction,
  requireRequest,
} from './recall-context.js';

type Database = NodePgDatabase<typeof schema>;
export async function completeUpgrade(
  audit: RequestAuditService,
  db: Database,
  id: string,
  dto: CompleteUpgradeDto,
  actor: AuthenticatedEmployee,
) {
  assertItHead(actor);
  await db.transaction(async (tx) => {
    await lockRequest(tx, id);
    const request = await requireRequest(tx, id, ['in_progress']);

    if (request.type !== 'upgrade') {
      throw new BadRequestException('Phiếu không phải yêu cầu nâng cấp.');
    }

    await lockAsset(tx, request.assetId);
    const warehouse = await requireActiveItWarehouse(tx);
    const asset = await loadAsset(tx, request.assetId);

    if (
      asset.currentWarehouseId !== warehouse.id ||
      asset.currentUserId !== null ||
      asset.status !== 'upgrading'
    ) {
      throw new ConflictException('Tài sản chưa sẵn sàng để trả sau nâng cấp.');
    }

    const now = new Date();

    await tx
      .update(schema.assetRecallRequests)
      .set({
        status: 'ready_for_return',
        processingResult: dto.processingResult.trim(),
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assetRecallRequests.id, id));
    await logAction(audit, tx, id, actor, {
      actionType: 'asset.recall.upgrade_completed',
      result: 'approved',
      previousStatus: request.status,
      newStatus: 'ready_for_return',
      revision: request.currentRevision,
    });
  });
}

export async function decideUpgradeReturn(
  audit: RequestAuditService,
  db: Database,
  id: string,
  dto: RecallHandoverDecisionDto,
  actor: AuthenticatedEmployee,
) {
  await db.transaction(async (tx) => {
    await lockRequest(tx, id);
    const request = await requireRequest(tx, id, ['ready_for_return']);

    if (request.type !== 'upgrade' || request.requestedBy !== actor.id) {
      throw new ForbiddenException(
        'Chỉ người gửi phiếu được xác nhận nhận lại tài sản.',
      );
    }

    await lockAsset(tx, request.assetId);
    const warehouse = await requireActiveItWarehouse(tx);
    const asset = await loadAsset(tx, request.assetId);

    if (
      asset.currentWarehouseId !== warehouse.id ||
      asset.currentUserId !== null ||
      asset.status !== 'upgrading'
    ) {
      throw new ConflictException('Tài sản không còn ở kho IT.');
    }

    const now = new Date();

    if (!dto.confirmed) {
      await tx
        .update(schema.assetRecallRequests)
        .set({
          status: 'in_progress',
          processingResult: null,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.assetRecallRequests.id, id));
      await logAction(audit, tx, id, actor, {
        actionType: 'asset.recall.upgrade_return_rejected',
        result: 'rejected',
        previousStatus: request.status,
        newStatus: 'in_progress',
        reason: dto.reason,
        revision: request.currentRevision,
      });

      return;
    }

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
      .where(eq(schema.assets.id, asset.id));
    await tx.insert(schema.assetHandoverHistory).values({
      assetId: asset.id,
      handoverType: 'upgrade_returned',
      handoverFromDepartmentId: warehouse.managingDepartmentId,
      handoverFromWarehouseId: warehouse.id,
      receivedByEmployeeId: request.requestedBy,
      receivedByDepartmentId: request.requestingDepartmentId,
      handoverDate: now.toISOString().slice(0, 10),
      status: 'completed',
      note: `Recall request ${request.id}`,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await tx
      .update(schema.assetRecallRequests)
      .set({
        status: 'completed',
        completedAt: now,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assetRecallRequests.id, id));
    await logAction(audit, tx, id, actor, {
      actionType: 'asset.recall.upgrade_return_confirmed',
      result: 'approved',
      previousStatus: request.status,
      newStatus: 'completed',
      revision: request.currentRevision,
    });
  });
}

export async function completeDisposal(
  audit: RequestAuditService,
  db: Database,
  id: string,
  dto: CompleteDisposalDto,
  actor: AuthenticatedEmployee,
) {
  assertItHead(actor);
  await db.transaction(async (tx) => {
    // Lock request và asset để thao tác hoàn tất chỉ chạy một lần.
    await lockRequest(tx, id);
    const request = await requireRequest(tx, id, ['in_progress']);

    if (request.type !== 'disposal') {
      throw new BadRequestException('Phiếu không phải yêu cầu báo phế.');
    }

    await lockAsset(tx, request.assetId);
    const warehouse = await requireActiveItWarehouse(tx);
    const asset = await loadAsset(tx, request.assetId);

    if (
      asset.currentWarehouseId !== warehouse.id ||
      asset.currentUserId !== null ||
      asset.status !== 'awaiting_disposal'
    ) {
      throw new ConflictException('Tài sản chưa sẵn sàng để báo phế.');
    }

    const now = new Date();

    await tx
      .update(schema.assets)
      .set({
        status: 'disposed',
        currentUserId: null,
        currentManagingDepartmentId: null,
        currentWarehouseId: null,
        currentLocation: null,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assets.id, asset.id));
    await tx.insert(schema.assetHandoverHistory).values({
      assetId: asset.id,
      handoverType: 'disposed',
      handoverFromDepartmentId: warehouse.managingDepartmentId,
      handoverFromWarehouseId: warehouse.id,
      handoverDate: dto.disposalDate,
      status: 'completed',
      note: dto.processingResult?.trim() || dto.disposalMethod.trim(),
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await tx
      .update(schema.assetRecallRequests)
      .set({
        status: 'completed',
        disposalDate: dto.disposalDate,
        disposalMethod: dto.disposalMethod.trim(),
        processingResult: dto.processingResult?.trim() || null,
        recoveryValue: dto.recoveryValue ?? null,
        completedAt: now,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assetRecallRequests.id, id));
    await logAction(audit, tx, id, actor, {
      actionType: 'asset.recall.disposal_completed',
      result: 'approved',
      previousStatus: request.status,
      newStatus: 'completed',
      revision: request.currentRevision,
      metadata: {
        disposalDate: dto.disposalDate,
        disposalMethod: dto.disposalMethod.trim(),
        recoveryValue: dto.recoveryValue,
      },
    });
  });
}
