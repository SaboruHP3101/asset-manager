import { ForbiddenException } from '@nestjs/common';
import { and, asc, eq, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { requireActiveItWarehouse } from '../warehouses/warehouses.service.js';
import {
  allowedActions,
  assertItHead,
  canView,
  isItHead,
  loadAsset,
  requireRequest,
} from './recall-context.js';

type Database = NodePgDatabase<typeof schema>;
export async function findMine(db: Database, actor: AuthenticatedEmployee) {
  return findSummaries(
    db,
    eq(schema.assetRecallRequests.requestedBy, actor.id),
  );
}

function recallQueueScope(actor: AuthenticatedEmployee) {
  const conditions = [];

  if (actor.isDepartmentHead) {
    conditions.push(
      and(
        eq(schema.assetRecallRequests.status, 'pending_department_head'),
        eq(
          schema.assetRecallRequests.requestingDepartmentId,
          actor.departmentId,
        ),
      )!,
    );
  }

  if (isItHead(actor)) {
    conditions.push(eq(schema.assetRecallRequests.status, 'pending_it_head'));
    conditions.push(
      and(
        eq(schema.assetRecallRequests.status, 'pending_handover_confirmations'),
        eq(schema.assetRecallRequests.itHandoverDecision, 'pending'),
      )!,
    );
    conditions.push(
      and(
        eq(schema.assetRecallRequests.type, 'disposal'),
        eq(schema.assetRecallRequests.status, 'in_progress'),
      )!,
    );
    conditions.push(
      and(
        eq(schema.assetRecallRequests.type, 'upgrade'),
        eq(schema.assetRecallRequests.status, 'in_progress'),
      )!,
    );
  }

  conditions.push(
    and(
      eq(schema.assetRecallRequests.requestedBy, actor.id),
      eq(schema.assetRecallRequests.status, 'pending_handover_confirmations'),
      eq(schema.assetRecallRequests.employeeHandoverDecision, 'pending'),
    )!,
  );
  conditions.push(
    and(
      eq(schema.assetRecallRequests.requestedBy, actor.id),
      eq(schema.assetRecallRequests.type, 'upgrade'),
      eq(schema.assetRecallRequests.status, 'ready_for_return'),
    )!,
  );

  return or(...conditions)!;
}

export async function findQueue(db: Database, actor: AuthenticatedEmployee) {
  return findSummaries(db, recallQueueScope(actor));
}

export async function findOne(
  audit: RequestAuditService,
  db: Database,
  id: string,
  actor: AuthenticatedEmployee,
) {
  const request = await requireRequest(db, id);

  if (!canView(request, actor)) {
    throw new ForbiddenException('Bạn không được xem phiếu thu hồi này.');
  }

  const [asset, requester, department, replacement, trail] = await Promise.all([
    loadAsset(db, request.assetId),
    db
      .select({ id: schema.employees.id, name: schema.employees.fullName })
      .from(schema.employees)
      .where(eq(schema.employees.id, request.requestedBy))
      .then((rows) => rows[0]),
    db
      .select({ id: schema.departments.id, name: schema.departments.name })
      .from(schema.departments)
      .where(eq(schema.departments.id, request.requestingDepartmentId))
      .then((rows) => rows[0]),
    request.replacementAssetId
      ? loadAsset(db, request.replacementAssetId)
      : Promise.resolve(null),
    audit.findTrail('recall', id),
  ]);

  return {
    ...request,
    asset,
    replacementAsset: replacement,
    requester,
    department,
    trail,
    allowedActions: allowedActions(request, actor),
  };
}

export async function findExchangeCandidates(
  db: Database,
  actor: AuthenticatedEmployee,
) {
  assertItHead(actor);
  const warehouse = await requireActiveItWarehouse(db);

  return db
    .select({
      id: schema.assets.id,
      assetCode: schema.assets.assetCode,
      name: schema.assets.name,
      category: schema.assetCategories.name,
      currentValue: schema.assets.currentValue,
    })
    .from(schema.assets)
    .innerJoin(
      schema.assetCategories,
      eq(schema.assets.assetCategoryId, schema.assetCategories.id),
    )
    .where(
      and(
        eq(schema.assets.currentWarehouseId, warehouse.id),
        eq(schema.assets.status, 'available'),
        eq(schema.assetCategories.managementOwner, 'it'),
      ),
    )
    .orderBy(asc(schema.assets.assetCode));
}

export function findSummaries(db: Database, condition: ReturnType<typeof eq>) {
  return db
    .select({
      id: schema.assetRecallRequests.id,
      type: schema.assetRecallRequests.type,
      status: schema.assetRecallRequests.status,
      currentRevision: schema.assetRecallRequests.currentRevision,
      reason: schema.assetRecallRequests.reason,
      assetId: schema.assets.id,
      assetCode: schema.assets.assetCode,
      assetName: schema.assets.name,
      requestedBy: schema.assetRecallRequests.requestedBy,
      requesterName: schema.employees.fullName,
      departmentName: schema.departments.name,
      createdAt: schema.assetRecallRequests.createdAt,
      updatedAt: schema.assetRecallRequests.updatedAt,
    })
    .from(schema.assetRecallRequests)
    .innerJoin(
      schema.assets,
      eq(schema.assetRecallRequests.assetId, schema.assets.id),
    )
    .innerJoin(
      schema.employees,
      eq(schema.assetRecallRequests.requestedBy, schema.employees.id),
    )
    .innerJoin(
      schema.departments,
      eq(
        schema.assetRecallRequests.requestingDepartmentId,
        schema.departments.id,
      ),
    )
    .where(condition)
    .orderBy(asc(schema.assetRecallRequests.createdAt));
}

export async function countQueue(db: Database, actor: AuthenticatedEmployee) {
  return db.$count(findSummaries(db, recallQueueScope(actor)).as('queue'));
}
