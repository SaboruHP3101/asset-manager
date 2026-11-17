import { ConflictException, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';

type Database = NodePgDatabase<typeof schema>;

type PurchaseRequestStatus =
  (typeof schema.purchaseRequestStatusEnum.enumValues)[number];

/** Lists requests created by the current employee. */
export async function findMine(db: Database, actor: AuthenticatedEmployee) {
  return db
    .select({
      id: schema.purchaseRequests.id,
      requestCode: schema.purchaseRequests.requestCode,
      status: schema.purchaseRequests.status,
      revision: schema.purchaseRequests.currentRevision,
      updatedAt: schema.purchaseRequests.updatedAt,
    })
    .from(schema.purchaseRequests)
    .where(eq(schema.purchaseRequests.requesterId, actor.id))
    .orderBy(desc(schema.purchaseRequests.updatedAt));
}

/** Lists requests awaiting an action in the current employee’s scope. */
export function purchaseQueueScope(actor: AuthenticatedEmployee) {
  const conditions = [];

  if (actor.isDepartmentHead) {
    conditions.push(
      and(
        eq(schema.purchaseRequests.status, 'pending_department_head'),
        eq(schema.purchaseRequests.departmentId, actor.departmentId),
      ),
    );
  }

  if (actor.departmentName === 'PROCUREMENT') {
    conditions.push(
      eq(schema.purchaseRequests.status, 'pending_procurement_enrichment'),
    );

    if (actor.isDepartmentHead) {
      conditions.push(
        eq(schema.purchaseRequests.status, 'pending_procurement_head'),
      );
    }
  }

  if (actor.departmentName === 'IT' && actor.isDepartmentHead) {
    conditions.push(eq(schema.purchaseRequests.status, 'pending_it_head'));
  }

  return or(...conditions) ?? sql`false`;
}

function findQueueQuery(db: Database, actor: AuthenticatedEmployee) {
  return db
    .select({
      id: schema.purchaseRequests.id,
      requestCode: schema.purchaseRequests.requestCode,
      status: schema.purchaseRequests.status,
      revision: schema.purchaseRequests.currentRevision,
      requesterName: schema.employees.fullName,
      updatedAt: schema.purchaseRequests.updatedAt,
    })
    .from(schema.purchaseRequests)
    .innerJoin(
      schema.employees,
      eq(schema.purchaseRequests.requesterId, schema.employees.id),
    )
    .where(purchaseQueueScope(actor))
    .orderBy(asc(schema.purchaseRequests.updatedAt));
}

/** Builds request details after the caller has checked access. */
export async function buildDetail(
  db: Database,
  audit: RequestAuditService,
  id: string,
  actor: AuthenticatedEmployee,
) {
  const [request] = await db
    .select({
      id: schema.purchaseRequests.id,
      requestCode: schema.purchaseRequests.requestCode,
      status: schema.purchaseRequests.status,
      currentRevision: schema.purchaseRequests.currentRevision,
      requesterId: schema.purchaseRequests.requesterId,
      requesterName: schema.employees.fullName,
      departmentId: schema.purchaseRequests.departmentId,
      departmentName: schema.departments.name,
      createdAt: schema.purchaseRequests.createdAt,
      updatedAt: schema.purchaseRequests.updatedAt,
    })
    .from(schema.purchaseRequests)
    .innerJoin(
      schema.employees,
      eq(schema.purchaseRequests.requesterId, schema.employees.id),
    )
    .innerJoin(
      schema.departments,
      eq(schema.purchaseRequests.departmentId, schema.departments.id),
    )
    .where(eq(schema.purchaseRequests.id, id));

  if (!request) throw new NotFoundException('Không tìm thấy đề nghị mua.');

  const [revision] = await db
    .select()
    .from(schema.purchaseRequestRevisions)
    .where(
      and(
        eq(schema.purchaseRequestRevisions.purchaseRequestId, id),
        eq(
          schema.purchaseRequestRevisions.revisionNumber,
          request.currentRevision,
        ),
      ),
    );
  const items = await db
    .select({
      id: schema.purchaseRequestItems.id,
      assetCategoryId: schema.purchaseRequestItems.assetCategoryId,
      categoryName: schema.assetCategories.name,
      itemName: schema.purchaseRequestItems.itemName,
      customCategoryDescription:
        schema.purchaseRequestItems.customCategoryDescription,
      specifications: schema.purchaseRequestItems.specifications,
      purpose: schema.purchaseRequestItems.purpose,
      quantity: schema.purchaseRequestItems.quantity,
      managementOwner: schema.purchaseRequestItems.managementOwnerSnapshot,
      trackingMode: schema.purchaseRequestItems.trackingModeSnapshot,
      sortOrder: schema.purchaseRequestItems.sortOrder,
    })
    .from(schema.purchaseRequestItems)
    .innerJoin(
      schema.assetCategories,
      eq(
        schema.purchaseRequestItems.assetCategoryId,
        schema.assetCategories.id,
      ),
    )
    .where(eq(schema.purchaseRequestItems.requestRevisionId, revision.id))
    .orderBy(asc(schema.purchaseRequestItems.sortOrder));
  const visibleItems =
    actor.departmentName === 'IT'
      ? items.filter((item) => item.managementOwner === 'it')
      : items;
  const itemIds = visibleItems.map((item) => item.id);
  const quotes =
    itemIds.length === 0
      ? []
      : await db
          .select({
            id: schema.purchaseRequestQuotes.id,
            requestItemId: schema.purchaseRequestQuotes.requestItemId,
            supplierId: schema.purchaseRequestQuotes.supplierId,
            supplierName: schema.suppliers.legalName,
            attachmentId: schema.purchaseRequestQuotes.attachmentId,
            attachmentUrl: schema.attachments.url,
            unitPriceExclVat: schema.purchaseRequestQuotes.unitPriceExclVat,
            vatRate: schema.purchaseRequestQuotes.vatRate,
            isSelected: schema.purchaseRequestQuotes.isSelected,
            note: schema.purchaseRequestQuotes.note,
          })
          .from(schema.purchaseRequestQuotes)
          .innerJoin(
            schema.suppliers,
            eq(schema.purchaseRequestQuotes.supplierId, schema.suppliers.id),
          )
          .innerJoin(
            schema.attachments,
            eq(
              schema.purchaseRequestQuotes.attachmentId,
              schema.attachments.id,
            ),
          )
          .where(inArray(schema.purchaseRequestQuotes.requestItemId, itemIds));
  const timeline = await audit.findTrail('purchase', id);
  const nextAction = pendingAction(request.status);
  const allowedActions = allowedActionsForRequest(actor, request);

  return {
    id: request.id,
    status: request.status,
    revision: request.currentRevision,
    pendingAction: nextAction,
    allowedActions,
    timeline,
    data: {
      ...request,
      revision: {
        id: revision.id,
        neededByDate: revision.neededByDate,
        purpose: revision.purpose,
        note: revision.note,
        submittedAt: revision.submittedAt,
        returnReason: revision.returnReason,
      },
      items: visibleItems.map((item) => ({
        ...item,
        quotes: quotes.filter((quote) => quote.requestItemId === item.id),
      })),
    },
  };
}

function pendingAction(status: PurchaseRequestStatus): WorkflowAction | null {
  const actions: Partial<Record<PurchaseRequestStatus, WorkflowAction>> = {
    draft: WORKFLOW_ACTIONS.purchaseRequestSubmit,
    revision_required: WORKFLOW_ACTIONS.purchaseRequestSubmit,
    pending_department_head: WORKFLOW_ACTIONS.purchaseRequestApproveDepartment,
    pending_procurement_enrichment:
      WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
    pending_procurement_head:
      WORKFLOW_ACTIONS.purchaseRequestApproveProcurement,
    pending_it_head: WORKFLOW_ACTIONS.purchaseRequestApproveIt,
  };

  return actions[status] ?? null;
}

function allowedActionsForRequest(
  actor: AuthenticatedEmployee,
  request: {
    requesterId: string;
    departmentId: string;
    status: PurchaseRequestStatus;
  },
) {
  const configured = getAllowedWorkflowActions(
    actor.isDepartmentHead,
    actor.departmentName,
  );
  const candidates: WorkflowAction[] = [];

  // Đề nghị đã duyệt hoặc đang đặt dở cho phép nhân viên Thu mua mở form đơn mua;
  if (['approved', 'ordering'].includes(request.status)) {
    candidates.push(WORKFLOW_ACTIONS.purchaseOrderCreate);
  }

  if (
    request.requesterId === actor.id &&
    ['draft', 'revision_required'].includes(request.status)
  ) {
    candidates.push(
      WORKFLOW_ACTIONS.purchaseRequestUpdate,
      WORKFLOW_ACTIONS.purchaseRequestSubmit,
    );
  }

  if (request.requesterId === actor.id && request.status === 'draft') {
    candidates.push(WORKFLOW_ACTIONS.purchaseRequestDeleteDraft);
  }

  const pending = pendingAction(request.status);

  if (pending) candidates.push(pending);

  return [...new Set(candidates)].filter((action) =>
    configured.includes(action),
  );
}

/** Locks the request before validating its current workflow status. */
export async function requireRequest(
  db: Database,
  id: string,
  statuses: PurchaseRequestStatus[],
) {
  await db.execute(
    sql`select id from purchase_requests where id = ${id} for update`,
  );
  const [request] = await db
    .select()
    .from(schema.purchaseRequests)
    .where(eq(schema.purchaseRequests.id, id));

  if (!request) throw new NotFoundException('Không tìm thấy đề nghị mua.');

  if (statuses && !statuses.includes(request.status)) {
    throw new ConflictException(
      `Không thể thực hiện hành động khi đề nghị ở trạng thái ${request.status}.`,
    );
  }

  return request;
}

/** Loads the active revision or throws when it is missing. */
export async function requireCurrentRevision(
  db: Database,
  request: typeof schema.purchaseRequests.$inferSelect,
) {
  const [revision] = await db
    .select()
    .from(schema.purchaseRequestRevisions)
    .where(
      and(
        eq(schema.purchaseRequestRevisions.purchaseRequestId, request.id),
        eq(
          schema.purchaseRequestRevisions.revisionNumber,
          request.currentRevision,
        ),
      ),
    );

  if (!revision)
    throw new ConflictException('Revision hiện tại không tồn tại.');

  return revision;
}

/** Lists revision items in their display order. */
export function loadRevisionItems(db: Database, revisionId: string) {
  return db
    .select()
    .from(schema.purchaseRequestItems)
    .where(eq(schema.purchaseRequestItems.requestRevisionId, revisionId))
    .orderBy(asc(schema.purchaseRequestItems.sortOrder));
}

/** Updates the request status using the caller’s transaction. */
export function setStatus(
  db: Database,
  id: string,
  status: PurchaseRequestStatus,
  actorId: string,
) {
  return db
    .update(schema.purchaseRequests)
    .set({ status, updatedAt: new Date(), updatedBy: actorId })
    .where(eq(schema.purchaseRequests.id, id));
}

export async function findQueue(db: Database, actor: AuthenticatedEmployee) {
  return findQueueQuery(db, actor);
}

export async function countQueue(db: Database, actor: AuthenticatedEmployee) {
  return db.$count(findQueueQuery(db, actor).as('queue'));
}
