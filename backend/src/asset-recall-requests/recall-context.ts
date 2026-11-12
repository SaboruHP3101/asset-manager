import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { requireActiveItWarehouse } from '../warehouses/warehouses.service.js';

type Database = NodePgDatabase<typeof schema>;
type RecallStatus = (typeof schema.assetRecallStatusEnum.enumValues)[number];
type RecallRecord = typeof schema.assetRecallRequests.$inferSelect;

export async function requireRequest(
  db: Database,
  id: string,
  statuses?: RecallStatus[],
) {
  const [request] = await db
    .select()
    .from(schema.assetRecallRequests)
    .where(eq(schema.assetRecallRequests.id, id));

  if (!request) throw new NotFoundException('Không tìm thấy phiếu thu hồi.');

  if (statuses && !statuses.includes(request.status)) {
    throw new BadRequestException(
      `Không thể thực hiện ở trạng thái ${request.status}.`,
    );
  }

  return request;
}

export async function loadAsset(db: Database, id: string) {
  const [asset] = await db
    .select({
      id: schema.assets.id,
      assetCode: schema.assets.assetCode,
      name: schema.assets.name,
      status: schema.assets.status,
      currentValue: schema.assets.currentValue,
      currentLocation: schema.assets.currentLocation,
      currentUserId: schema.assets.currentUserId,
      currentWarehouseId: schema.assets.currentWarehouseId,
      managementOwner: schema.assetCategories.managementOwner,
      category: schema.assetCategories.name,
    })
    .from(schema.assets)
    .innerJoin(
      schema.assetCategories,
      eq(schema.assets.assetCategoryId, schema.assetCategories.id),
    )
    .where(eq(schema.assets.id, id));

  if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');

  return asset;
}

export async function requireOwnedItAsset(
  db: Database,
  assetId: string,
  employeeId: string,
) {
  const asset = await loadAsset(db, assetId);

  if (asset.currentUserId !== employeeId || asset.managementOwner !== 'it') {
    throw new BadRequestException(
      'Chỉ có thể tạo phiếu cho thiết bị điện tử đang được giao cho bạn.',
    );
  }

  return asset;
}

export async function assertNoActiveRequest(db: Database, assetId: string) {
  const [active] = await db
    .select({ id: schema.assetRecallRequests.id })
    .from(schema.assetRecallRequests)
    .where(
      and(
        eq(schema.assetRecallRequests.assetId, assetId),
        inArray(schema.assetRecallRequests.status, [
          'draft',
          'pending_department_head',
          'pending_it_head',
          'revision_required',
          'pending_handover_confirmations',
          'in_progress',
          'ready_for_return',
        ]),
      ),
    );

  if (active) {
    throw new ConflictException('Tài sản đã có phiếu thu hồi chưa hoàn tất.');
  }

  const [repair] = await db
    .select({ id: schema.repairRequests.id })
    .from(schema.repairRequests)
    .where(
      and(
        eq(schema.repairRequests.assetId, assetId),
        sql`${schema.repairRequests.status} not in ('closed', 'cancelled')`,
      ),
    );

  if (repair) {
    throw new ConflictException(
      'Tài sản đang có phiếu sửa chữa chưa hoàn tất.',
    );
  }
}

export async function requireExchangeCandidate(
  db: Database,
  replacementAssetId: string,
  originalAssetId: string,
) {
  if (replacementAssetId === originalAssetId) {
    throw new BadRequestException(
      'Tài sản thay thế phải khác tài sản thu hồi.',
    );
  }

  const warehouse = await requireActiveItWarehouse(db);
  const candidate = await loadAsset(db, replacementAssetId);

  if (
    candidate.managementOwner !== 'it' ||
    candidate.currentWarehouseId !== warehouse.id ||
    candidate.currentUserId !== null ||
    candidate.status !== 'available'
  ) {
    throw new ConflictException(
      'Tài sản thay thế không còn sẵn sàng trong kho IT.',
    );
  }

  return candidate;
}

export async function requireReservedReplacement(
  db: Database,
  assetId: string,
  warehouseId: string,
) {
  const asset = await loadAsset(db, assetId);

  if (
    asset.currentWarehouseId !== warehouseId ||
    asset.currentUserId !== null ||
    asset.status !== 'reserved_for_exchange'
  ) {
    throw new ConflictException('Tài sản thay thế không còn được giữ chỗ.');
  }

  return asset;
}

export async function releaseReplacement(
  db: Database,
  assetId: string,
  actorId: string,
) {
  await db
    .update(schema.assets)
    .set({ status: 'available', updatedAt: new Date(), updatedBy: actorId })
    .where(
      and(
        eq(schema.assets.id, assetId),
        eq(schema.assets.status, 'reserved_for_exchange'),
      ),
    );
}

export function assertOwner(
  request: RecallRecord,
  actor: AuthenticatedEmployee,
) {
  if (request.requestedBy !== actor.id) {
    throw new ForbiddenException('Chỉ người tạo mới được sửa phiếu.');
  }
}

export function assertItHead(actor: AuthenticatedEmployee) {
  if (!isItHead(actor)) {
    throw new ForbiddenException('Chỉ Trưởng IT được thực hiện thao tác này.');
  }
}

export function isItHead(actor: AuthenticatedEmployee) {
  return actor.isDepartmentHead && actor.departmentName === 'IT';
}

export function canView(request: RecallRecord, actor: AuthenticatedEmployee) {
  return (
    request.requestedBy === actor.id ||
    (actor.isDepartmentHead &&
      actor.departmentId === request.requestingDepartmentId) ||
    isItHead(actor)
  );
}

export function allowedActions(
  request: RecallRecord,
  actor: AuthenticatedEmployee,
): WorkflowAction[] {
  const actions: WorkflowAction[] = [];

  if (
    request.requestedBy === actor.id &&
    ['draft', 'revision_required'].includes(request.status)
  ) {
    actions.push(
      WORKFLOW_ACTIONS.assetRecallUpdate,
      WORKFLOW_ACTIONS.assetRecallSubmit,
    );
  }

  if (
    request.status === 'pending_department_head' &&
    actor.isDepartmentHead &&
    actor.departmentId === request.requestingDepartmentId
  ) {
    actions.push(WORKFLOW_ACTIONS.assetRecallApproveDepartment);
  }

  if (request.status === 'pending_it_head' && isItHead(actor)) {
    actions.push(WORKFLOW_ACTIONS.assetRecallApproveIt);
  }

  if (
    request.status === 'pending_handover_confirmations' &&
    ((request.requestedBy === actor.id &&
      request.employeeHandoverDecision === 'pending') ||
      (isItHead(actor) && request.itHandoverDecision === 'pending'))
  ) {
    actions.push(WORKFLOW_ACTIONS.assetRecallConfirmHandover);
  }

  if (
    request.type === 'disposal' &&
    request.status === 'in_progress' &&
    isItHead(actor)
  ) {
    actions.push(WORKFLOW_ACTIONS.assetRecallCompleteDisposal);
  }

  if (
    request.type === 'upgrade' &&
    request.status === 'in_progress' &&
    isItHead(actor)
  ) {
    actions.push(WORKFLOW_ACTIONS.assetRecallProcessUpgrade);
  }

  if (
    request.type === 'upgrade' &&
    request.status === 'ready_for_return' &&
    request.requestedBy === actor.id
  ) {
    actions.push(WORKFLOW_ACTIONS.assetRecallConfirmUpgradeReturn);
  }

  return actions;
}

export function handoverSide(
  request: RecallRecord,
  actor: AuthenticatedEmployee,
): 'employee' | 'it' {
  if (
    request.requestedBy === actor.id &&
    request.employeeHandoverDecision === 'pending'
  ) {
    return 'employee';
  }

  if (isItHead(actor) && request.itHandoverDecision === 'pending') {
    return 'it';
  }

  throw new ForbiddenException(
    'Bạn không có xác nhận bàn giao đang chờ trên phiếu này.',
  );
}

export function lockAsset(db: Database, id: string) {
  return db.execute(sql`select id from assets where id = ${id} for update`);
}

export function lockRequest(db: Database, id: string) {
  return db.execute(
    sql`select id from asset_recall_requests where id = ${id} for update`,
  );
}

export function logAction(
  audit: RequestAuditService,
  db: Database,
  requestId: string,
  actor: AuthenticatedEmployee,
  entry: {
    actionType: string;
    result: 'approved' | 'rejected' | 'pending';
    previousStatus: string;
    newStatus: string;
    reason?: string;
    revision?: number;
    metadata?: Record<string, unknown>;
  },
) {
  return audit.log(db, {
    requestType: 'recall',
    requestId,
    workflowRevision: entry.revision,
    actionType: entry.actionType,
    approvedBy: actor.id,
    approverRole: actor.roleName,
    actorDepartmentId: actor.departmentId,
    actorIsDepartmentHead: actor.isDepartmentHead,
    status: entry.result,
    previousStatus: entry.previousStatus,
    newStatus: entry.newStatus,
    reason: entry.reason,
    notes: entry.reason,
    metadata: entry.metadata,
  });
}
