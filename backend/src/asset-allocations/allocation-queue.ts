import { ForbiddenException } from '@nestjs/common';
import { and, asc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import {
  actionsFor,
  canRead,
  canReallocate,
  requireAllocationContext,
} from './allocation-context.js';

type Database = NodePgDatabase<typeof schema>;
function assetQueueScope(actor: AuthenticatedEmployee) {
  const actions = actionsFor(actor);
  const assetConditions: SQL[] = [];

  if (
    actor.isDepartmentHead &&
    actions.includes(WORKFLOW_ACTIONS.purchaseAllocationCreateInitial)
  ) {
    assetConditions.push(
      and(
        eq(schema.assets.status, 'awaiting_allocation'),
        eq(schema.purchaseRequests.departmentId, actor.departmentId),
      )!,
    );
  }

  for (const owner of ['it', 'procurement'] as const) {
    if (canReallocate(actor, owner)) {
      assetConditions.push(
        and(
          eq(schema.assets.status, 'awaiting_reallocation'),
          eq(schema.assetCategories.managementOwner, owner),
        )!,
      );
    }
  }

  return or(...assetConditions) ?? sql`false`;
}

export async function findQueue(db: Database, actor: AuthenticatedEmployee) {
  const actions = actionsFor(actor);
  const [assets, allocations] = await Promise.all([
    loadAssetQueueCandidates(db, assetQueueScope(actor)),
    loadAllocationQueueCandidates(db, actor),
  ]);

  type AssetCandidate = (typeof assets)[number];
  type Confirmation = (typeof allocations)[number];
  const queue: Array<
    | (AssetCandidate & { queueType: 'initial' | 'reallocation' })
    | (Confirmation & {
        queueType: 'confirmation';
        decisionParty: 'recipient' | 'department';
      })
  > = [];

  if (
    actor.isDepartmentHead &&
    actions.includes(WORKFLOW_ACTIONS.purchaseAllocationCreateInitial)
  ) {
    queue.push(
      ...assets
        .filter(
          (asset) =>
            asset.status === 'awaiting_allocation' &&
            asset.requestDepartmentId === actor.departmentId,
        )
        .map((asset) => ({ ...asset, queueType: 'initial' as const })),
    );
  }

  queue.push(
    ...allocations
      .filter(
        (item) =>
          item.allocationStatus === 'pending_confirmations' &&
          ((actor.isDepartmentHead &&
            item.departmentId === actor.departmentId &&
            item.departmentHeadDecision === 'pending') ||
            (item.recipientId === actor.id &&
              item.recipientDecision === 'pending')),
      )
      .map((item) => ({
        ...item,
        queueType: 'confirmation' as const,
        decisionParty:
          item.recipientId === actor.id && item.recipientDecision === 'pending'
            ? ('recipient' as const)
            : ('department' as const),
      })),
  );

  queue.push(
    ...assets
      .filter(
        (asset) =>
          asset.status === 'awaiting_reallocation' &&
          canReallocate(actor, asset.managementOwner),
      )
      .map((asset) => ({ ...asset, queueType: 'reallocation' as const })),
  );

  const progressByRequest = new Map<string, Record<string, number>>();

  if (queue.length === 0) return [];

  const requestIds = [...new Set(queue.map((item) => item.requestId))];
  // Progress includes all assets in the visible requests, including activated assets.
  const requestAssets = await loadAssetQueueCandidates(
    db,
    inArray(schema.purchaseRequests.id, requestIds),
  );

  for (const asset of requestAssets) {
    const progress = progressByRequest.get(asset.requestId) ?? {
      totalAssets: 0,
      allocatedAssets: 0,
      pendingAssets: 0,
    };

    progress.totalAssets += 1;

    if (asset.status === 'active') progress.allocatedAssets += 1;
    else progress.pendingAssets += 1;

    progressByRequest.set(asset.requestId, progress);
  }

  return queue.map((item) => ({
    ...item,
    ...progressByRequest.get(item.requestId),
  }));
}

export async function findRecipients(
  db: Database,
  departmentId: string,
  actor: AuthenticatedEmployee,
) {
  const actions = actionsFor(actor);
  const canCreateInitial =
    actor.isDepartmentHead &&
    actor.departmentId === departmentId &&
    actions.includes(WORKFLOW_ACTIONS.purchaseAllocationCreateInitial);
  const canReallocate =
    actions.includes(WORKFLOW_ACTIONS.purchaseAllocationReallocateIt) ||
    actions.includes(WORKFLOW_ACTIONS.purchaseAllocationReallocateProcurement);

  if (!canCreateInitial && !canReallocate) {
    throw new ForbiddenException('Bạn không có quyền chọn người nhận.');
  }

  return db
    .select({
      id: schema.employees.id,
      employeeCode: schema.employees.employeeCode,
      fullName: schema.employees.fullName,
      departmentId: schema.employees.departmentId,
    })
    .from(schema.employees)
    .where(
      and(
        eq(schema.employees.departmentId, departmentId),
        eq(schema.employees.isActive, true),
      ),
    )
    .orderBy(asc(schema.employees.fullName));
}

export async function findOne(
  db: Database,
  id: string,
  actor: AuthenticatedEmployee,
) {
  const allocation = await requireAllocationContext(db, id);

  if (!canRead(allocation, actor)) {
    throw new ForbiddenException('Bạn không có quyền xem lần cấp phát này.');
  }

  return allocation;
}

export function loadAssetQueueCandidates(db: Database, condition: SQL) {
  return db
    .select({
      assetId: schema.assets.id,
      assetCode: schema.assets.assetCode,
      assetName: schema.assets.name,
      status: schema.assets.status,
      managementOwner: schema.assetCategories.managementOwner,
      requestId: schema.purchaseRequests.id,
      requestCode: schema.purchaseRequests.requestCode,
      requestDepartmentId: schema.purchaseRequests.departmentId,
    })
    .from(schema.assets)
    .innerJoin(
      schema.assetCategories,
      eq(schema.assets.assetCategoryId, schema.assetCategories.id),
    )
    .innerJoin(
      schema.purchaseOrderItems,
      eq(schema.assets.purchaseOrderItemId, schema.purchaseOrderItems.id),
    )
    .innerJoin(
      schema.purchaseRequestItems,
      eq(
        schema.purchaseOrderItems.purchaseRequestItemId,
        schema.purchaseRequestItems.id,
      ),
    )
    .innerJoin(
      schema.purchaseRequestRevisions,
      eq(
        schema.purchaseRequestItems.requestRevisionId,
        schema.purchaseRequestRevisions.id,
      ),
    )
    .innerJoin(
      schema.purchaseRequests,
      eq(
        schema.purchaseRequestRevisions.purchaseRequestId,
        schema.purchaseRequests.id,
      ),
    )
    .where(condition)
    .orderBy(asc(schema.assets.assetCode));
}

export function loadAllocationQueueCandidates(
  db: Database,
  actor: AuthenticatedEmployee,
) {
  return db
    .select({
      allocationId: schema.assetAllocations.id,
      assetId: schema.assets.id,
      assetCode: schema.assets.assetCode,
      assetName: schema.assets.name,
      requestId: schema.purchaseRequests.id,
      requestCode: schema.purchaseRequests.requestCode,
      requestDepartmentId: schema.purchaseRequests.departmentId,
      allocationStatus: schema.assetAllocations.status,
      departmentId: schema.assetAllocations.departmentId,
      targetType: schema.assetAllocations.targetType,
      recipientId: schema.assetAllocations.recipientId,
      recipientName: schema.employees.fullName,
      location: schema.assetAllocations.location,
      departmentHeadDecision: schema.assetAllocations.departmentHeadDecision,
      recipientDecision: schema.assetAllocations.recipientDecision,
    })
    .from(schema.assetAllocations)
    .innerJoin(
      schema.assets,
      eq(schema.assetAllocations.assetId, schema.assets.id),
    )
    .leftJoin(
      schema.employees,
      eq(schema.assetAllocations.recipientId, schema.employees.id),
    )
    .innerJoin(
      schema.purchaseOrderItems,
      eq(schema.assets.purchaseOrderItemId, schema.purchaseOrderItems.id),
    )
    .innerJoin(
      schema.purchaseRequestItems,
      eq(
        schema.purchaseOrderItems.purchaseRequestItemId,
        schema.purchaseRequestItems.id,
      ),
    )
    .innerJoin(
      schema.purchaseRequestRevisions,
      eq(
        schema.purchaseRequestItems.requestRevisionId,
        schema.purchaseRequestRevisions.id,
      ),
    )
    .innerJoin(
      schema.purchaseRequests,
      eq(
        schema.purchaseRequestRevisions.purchaseRequestId,
        schema.purchaseRequests.id,
      ),
    )
    .where(
      and(
        eq(schema.assetAllocations.status, 'pending_confirmations'),
        or(
          and(
            eq(schema.assetAllocations.recipientId, actor.id),
            eq(schema.assetAllocations.recipientDecision, 'pending'),
          ),
          actor.isDepartmentHead
            ? and(
                eq(schema.assetAllocations.departmentId, actor.departmentId),
                eq(schema.assetAllocations.departmentHeadDecision, 'pending'),
              )
            : undefined,
        ),
      ),
    )
    .orderBy(asc(schema.assets.assetCode));
}

export async function countQueue(db: Database, actor: AuthenticatedEmployee) {
  const [assets, allocations] = await Promise.all([
    db.$count(
      loadAssetQueueCandidates(db, assetQueueScope(actor)).as('asset_queue'),
    ),
    db.$count(loadAllocationQueueCandidates(db, actor).as('allocation_queue')),
  ]);

  return assets + allocations;
}
