import { BadRequestException } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { SavePurchaseRequestDto } from './dto/purchase-request.dto.js';

import {
  loadRevisionItems,
  requireCurrentRevision,
  requireRequest,
} from './purchase-request-queries.js';

type Database = NodePgDatabase<typeof schema>;

/** Creates a draft and its first revision atomically; returns the request ID. */
export async function create(
  db: Database,
  authorization: PurchaseAuthorizationService,
  audit: RequestAuditService,
  dto: SavePurchaseRequestDto,
  actor: AuthenticatedEmployee,
) {
  authorization.assertAction(actor, WORKFLOW_ACTIONS.purchaseRequestCreate);
  const categories = await loadCategories(db, dto);
  const requestId = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(schema.purchaseRequests)
      .values({
        requestCode: createRequestCode(),
        requesterId: actor.id,
        departmentId: actor.departmentId,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    const [revision] = await tx
      .insert(schema.purchaseRequestRevisions)
      .values({
        purchaseRequestId: request.id,
        revisionNumber: 1,
        neededByDate: dto.neededByDate,
        purpose: dto.purpose,
        note: dto.note,
        createdBy: actor.id,
      })
      .returning();

    await insertItems(tx, revision.id, dto, categories, actor.id);
    await audit.logPurchase(tx, {
      requestId: request.id,
      revision: 1,
      actionType: 'purchase.request.create',
      actor,
      result: 'pending',
      previousStatus: 'draft',
      newStatus: 'draft',
      entityType: 'request',
      entityId: request.id,
    });

    return request.id;
  });

  return requestId;
}

/** Replaces the editable revision items without changing its snapshots policy. */
export async function update(
  db: Database,
  authorization: PurchaseAuthorizationService,
  audit: RequestAuditService,
  id: string,
  dto: SavePurchaseRequestDto,
  actor: AuthenticatedEmployee,
) {
  authorization.assertAction(actor, WORKFLOW_ACTIONS.purchaseRequestUpdate);
  await db.transaction(async (tx) => {
    const request = await requireRequest(tx, id, [
      'draft',
      'revision_required',
    ]);

    authorization.assertOwnRequest(actor, request);
    const revision = await requireCurrentRevision(tx, request);
    const existingItems = await loadRevisionItems(tx, revision.id);
    const categories = await loadCategories(
      tx,
      dto,
      new Set(existingItems.map((item) => item.assetCategoryId)),
    );

    await tx
      .update(schema.purchaseRequestRevisions)
      .set({
        neededByDate: dto.neededByDate,
        purpose: dto.purpose,
        note: dto.note ?? null,
      })
      .where(eq(schema.purchaseRequestRevisions.id, revision.id));
    await tx
      .delete(schema.purchaseRequestItems)
      .where(eq(schema.purchaseRequestItems.requestRevisionId, revision.id));
    await insertItems(tx, revision.id, dto, categories, actor.id);
    await tx
      .update(schema.purchaseRequests)
      .set({ updatedAt: new Date(), updatedBy: actor.id })
      .where(eq(schema.purchaseRequests.id, id));
    await audit.logPurchase(tx, {
      requestId: id,
      revision: request.currentRevision,
      actionType: 'purchase.request.update',
      actor,
      result: 'pending',
      previousStatus: request.status,
      newStatus: request.status,
      entityType: 'request',
      entityId: id,
    });
  });
}

/** Deletes an owned draft and its revision records in one transaction. */
export async function deleteDraft(
  db: Database,
  authorization: PurchaseAuthorizationService,
  id: string,
  actor: AuthenticatedEmployee,
) {
  authorization.assertAction(
    actor,
    WORKFLOW_ACTIONS.purchaseRequestDeleteDraft,
  );

  await db.transaction(async (tx) => {
    const request = await requireRequest(tx, id, ['draft']);

    authorization.assertOwnRequest(actor, request);

    const revisions = await tx
      .select({ id: schema.purchaseRequestRevisions.id })
      .from(schema.purchaseRequestRevisions)
      .where(eq(schema.purchaseRequestRevisions.purchaseRequestId, id));
    const revisionIds = revisions.map((revision) => revision.id);

    if (revisionIds.length > 0) {
      await tx
        .delete(schema.purchaseRequestItems)
        .where(
          inArray(schema.purchaseRequestItems.requestRevisionId, revisionIds),
        );
      await tx
        .delete(schema.purchaseRequestRevisions)
        .where(inArray(schema.purchaseRequestRevisions.id, revisionIds));
    }

    await tx
      .delete(schema.requestApprovals)
      .where(
        and(
          eq(schema.requestApprovals.requestType, 'purchase'),
          eq(schema.requestApprovals.requestId, id),
        ),
      );
    await tx
      .delete(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.id, id));
  });

  return { deleted: true };
}

/** Validates purchase categories, retaining categories already used by this revision. */
export async function loadCategories(
  db: Database,
  dto: SavePurchaseRequestDto,
  allowedLegacyIds: ReadonlySet<string> = new Set(),
) {
  const ids = [...new Set(dto.items.map((item) => item.assetCategoryId))];
  const categories = await db
    .select({
      id: schema.assetCategories.id,
      parentCategoryId: schema.assetCategories.parentCategoryId,
      managementOwner: schema.assetCategories.managementOwner,
      trackingMode: schema.assetCategories.trackingMode,
      isPurchaseOption: schema.assetCategories.isPurchaseOption,
      allowsCustomType: schema.assetCategories.allowsCustomType,
    })
    .from(schema.assetCategories)
    .where(inArray(schema.assetCategories.id, ids));

  if (categories.length !== ids.length) {
    throw new BadRequestException('Có danh mục tài sản không tồn tại.');
  }

  const parentIds = [
    ...new Set(
      categories.flatMap((category) =>
        category.parentCategoryId ? [category.parentCategoryId] : [],
      ),
    ),
  ];
  const parents = parentIds.length
    ? await db
        .select({
          id: schema.assetCategories.id,
          parentCategoryId: schema.assetCategories.parentCategoryId,
          isPurchaseOption: schema.assetCategories.isPurchaseOption,
        })
        .from(schema.assetCategories)
        .where(inArray(schema.assetCategories.id, parentIds))
    : [];
  const parentById = new Map(parents.map((parent) => [parent.id, parent]));
  const unavailableCategories = categories.filter((category) => {
    if (allowedLegacyIds.has(category.id)) return false;

    if (!category.isPurchaseOption || !category.parentCategoryId) return true;

    const parent = parentById.get(category.parentCategoryId);

    return (
      !parent || parent.parentCategoryId !== null || !parent.isPurchaseOption
    );
  });

  if (unavailableCategories.length > 0) {
    throw new BadRequestException(
      'Hạng mục phải sử dụng danh mục cấp 2 hợp lệ.',
    );
  }

  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );

  for (const item of dto.items) {
    const category = categoryById.get(item.assetCategoryId)!;
    const customDescription = item.customCategoryDescription?.trim();

    if (category.allowsCustomType && !customDescription) {
      throw new BadRequestException(
        'Vui lòng mô tả loại tài sản khi chọn loại Khác.',
      );
    }

    if (!category.allowsCustomType && customDescription) {
      throw new BadRequestException(
        'Chỉ được mô tả loại tài sản khi chọn loại Khác.',
      );
    }
  }

  return categoryById;
}

async function insertItems(
  db: Database,
  revisionId: string,
  dto: SavePurchaseRequestDto,
  categories: Awaited<ReturnType<typeof loadCategories>>,
  actorId: string,
) {
  await db.insert(schema.purchaseRequestItems).values(
    dto.items.map((item, index) => {
      const category = categories.get(item.assetCategoryId)!;

      return {
        requestRevisionId: revisionId,
        assetCategoryId: item.assetCategoryId,
        itemName: item.itemName,
        customCategoryDescription:
          item.customCategoryDescription?.trim() || null,
        specifications: item.specifications,
        purpose: item.purpose,
        quantity: item.quantity,
        unit: 'đơn vị',
        managementOwnerSnapshot: category.managementOwner,
        trackingModeSnapshot: category.trackingMode,
        sortOrder: index + 1,
        createdBy: actorId,
        updatedBy: actorId,
      };
    }),
  );
}

function createRequestCode() {
  const year = new Date().getUTCFullYear();

  return `PR-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Copies the current items into a new revision and notifies the requester. */
export async function returnForRevision(
  audit: RequestAuditService,
  notifications: NotificationsService,
  db: Database,
  request: typeof schema.purchaseRequests.$inferSelect,
  actor: AuthenticatedEmployee,
  reason: string,
) {
  const revision = await requireCurrentRevision(db, request);
  const items = await loadRevisionItems(db, revision.id);
  const nextRevisionNumber = request.currentRevision + 1;
  const now = new Date();

  await db
    .update(schema.purchaseRequestRevisions)
    .set({ returnedAt: now, returnedBy: actor.id, returnReason: reason })
    .where(eq(schema.purchaseRequestRevisions.id, revision.id));
  const [nextRevision] = await db
    .insert(schema.purchaseRequestRevisions)
    .values({
      purchaseRequestId: request.id,
      revisionNumber: nextRevisionNumber,
      neededByDate: revision.neededByDate,
      purpose: revision.purpose,
      note: revision.note,
      returnReason: reason,
      createdBy: request.requesterId,
    })
    .returning();

  await db.insert(schema.purchaseRequestItems).values(
    items.map((item) => ({
      requestRevisionId: nextRevision.id,
      assetCategoryId: item.assetCategoryId,
      itemName: item.itemName,
      customCategoryDescription: item.customCategoryDescription,
      specifications: item.specifications,
      purpose: item.purpose,
      quantity: item.quantity,
      unit: item.unit,
      managementOwnerSnapshot: item.managementOwnerSnapshot,
      trackingModeSnapshot: item.trackingModeSnapshot,
      sortOrder: item.sortOrder,
      createdBy: request.requesterId,
      updatedBy: request.requesterId,
    })),
  );
  await db
    .update(schema.purchaseRequests)
    .set({
      status: 'revision_required',
      currentRevision: nextRevisionNumber,
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.purchaseRequests.id, request.id));
  await audit.logPurchase(db, {
    requestId: request.id,
    revision: request.currentRevision,
    actionType: 'purchase.request.reject',
    actor,
    result: 'rejected',
    previousStatus: request.status,
    newStatus: 'revision_required',
    reason,
    entityType: 'request',
    entityId: request.id,
    metadata: { nextRevision: nextRevisionNumber },
  });
  await notifications.create(db, {
    recipientId: request.requesterId,
    eventType: 'purchase_request_returned_for_revision',
    entityType: 'request',
    entityId: request.id,
    title: 'Đề nghị mua cần điều chỉnh',
    body: `${request.requestCode} đã được trả về: ${reason}`,
    metadata: { revision: nextRevisionNumber },
  });
}
