import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';

type Database = NodePgDatabase<typeof schema>;
type DecisionParty = 'department' | 'recipient';
type ManagementOwner =
  (typeof schema.assetManagementOwnerEnum.enumValues)[number];

export async function requireAssetContext(db: Database, assetId: string) {
  const rows = await db
    .select({
      id: schema.assets.id,
      assetCode: schema.assets.assetCode,
      status: schema.assets.status,
      managementOwner: schema.assetCategories.managementOwner,
      requestId: schema.purchaseRequests.id,
      requestRevision: schema.purchaseRequests.currentRevision,
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
    .where(eq(schema.assets.id, assetId));
  const asset = rows[0];

  if (!asset) throw new NotFoundException('Không tìm thấy tài sản mua sắm.');

  return asset;
}

export async function requireAllocationContext(db: Database, id: string) {
  const rows = await db
    .select({
      id: schema.assetAllocations.id,
      assetId: schema.assetAllocations.assetId,
      attemptNumber: schema.assetAllocations.attemptNumber,
      initiatedBy: schema.assetAllocations.initiatedBy,
      departmentId: schema.assetAllocations.departmentId,
      departmentName: schema.departments.name,
      targetType: schema.assetAllocations.targetType,
      recipientId: schema.assetAllocations.recipientId,
      recipientName: schema.employees.fullName,
      location: schema.assetAllocations.location,
      managementOwner: schema.assetAllocations.managementOwnerSnapshot,
      allocationStatus: schema.assetAllocations.status,
      departmentHeadDecision: schema.assetAllocations.departmentHeadDecision,
      recipientDecision: schema.assetAllocations.recipientDecision,
      assetCode: schema.assets.assetCode,
      assetName: schema.assets.name,
      assetStatus: schema.assets.status,
      requestId: schema.purchaseRequests.id,
      requestRevision: schema.purchaseRequests.currentRevision,
      requestDepartmentId: schema.purchaseRequests.departmentId,
    })
    .from(schema.assetAllocations)
    .innerJoin(
      schema.assets,
      eq(schema.assetAllocations.assetId, schema.assets.id),
    )
    .innerJoin(
      schema.departments,
      eq(schema.assetAllocations.departmentId, schema.departments.id),
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
    .where(eq(schema.assetAllocations.id, id));
  const allocation = rows[0];

  if (!allocation) throw new NotFoundException('Không tìm thấy lần cấp phát.');

  return allocation;
}

export async function requireRecipient(db: Database, id: string) {
  const rows = await db
    .select({
      id: schema.employees.id,
      departmentId: schema.employees.departmentId,
      isActive: schema.employees.isActive,
    })
    .from(schema.employees)
    .where(eq(schema.employees.id, id));
  const recipient = rows[0];

  if (!recipient || !recipient.isActive) {
    throw new BadRequestException(
      'Người nhận không tồn tại hoặc đã ngừng hoạt động.',
    );
  }

  return recipient;
}

export function assertDecisionActor(
  allocation: Awaited<ReturnType<typeof requireAllocationContext>>,
  actor: AuthenticatedEmployee,
  party: DecisionParty,
) {
  if (
    party === 'department' &&
    (!actor.isDepartmentHead || actor.departmentId !== allocation.departmentId)
  ) {
    throw new ForbiddenException(
      'Chỉ Trưởng phòng nhận được xác nhận cấp phát.',
    );
  }

  if (party === 'recipient' && actor.id !== allocation.recipientId) {
    throw new ForbiddenException('Chỉ đúng người nhận được xác nhận cấp phát.');
  }
}

export function assertReallocationActor(
  actor: AuthenticatedEmployee,
  owner: ManagementOwner,
) {
  if (!canReallocate(actor, owner)) {
    throw new ForbiddenException(
      owner === 'it'
        ? 'Chỉ nhân viên IT được phân bổ lại tài sản này.'
        : 'Chỉ nhân viên Thu mua được phân bổ lại tài sản này.',
    );
  }
}

export function canReallocate(
  actor: AuthenticatedEmployee,
  owner: ManagementOwner,
) {
  const action =
    owner === 'it'
      ? WORKFLOW_ACTIONS.purchaseAllocationReallocateIt
      : WORKFLOW_ACTIONS.purchaseAllocationReallocateProcurement;

  return actionsFor(actor).includes(action);
}

export function canRead(
  allocation: Awaited<ReturnType<typeof requireAllocationContext>>,
  actor: AuthenticatedEmployee,
) {
  return (
    actor.id === allocation.recipientId ||
    actor.id === allocation.initiatedBy ||
    (actor.isDepartmentHead &&
      (actor.departmentId === allocation.departmentId ||
        actor.departmentId === allocation.requestDepartmentId)) ||
    canReallocate(actor, allocation.managementOwner)
  );
}

export function actionsFor(actor: AuthenticatedEmployee): WorkflowAction[] {
  return getAllowedWorkflowActions(
    actor.isDepartmentHead,
    actor.departmentName,
  );
}
