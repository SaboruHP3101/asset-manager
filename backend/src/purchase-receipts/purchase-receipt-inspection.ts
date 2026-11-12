import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { removeUploadedFiles } from '../attachments/upload-cleanup.js';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { InspectPurchaseReceiptUnitDto } from './dto/purchase-receipt.dto.js';
import {
  loadOrderItems,
  loadOrderProgress,
  lockOrder,
  requireUnitContext,
} from './purchase-receipt-queries.js';

type Database = NodePgDatabase<typeof schema>;
export async function inspectUnit(
  audit: RequestAuditService,
  authorization: PurchaseAuthorizationService,
  db: Database,
  notifications: NotificationsService,
  unitId: string,
  dto: InspectPurchaseReceiptUnitDto,
  evidence: Express.Multer.File | undefined,
  actor: AuthenticatedEmployee,
) {
  let evidenceSaved = false;

  try {
    const result = await db.transaction(async (tx) => {
      const candidate = await requireUnitContext(tx, unitId);

      await lockOrder(tx, candidate.purchaseOrderId);
      await tx.execute(
        sql`select id from purchase_receipt_units where id = ${unitId} for update`,
      );
      const context = await requireUnitContext(tx, unitId);
      const action =
        context.managementOwnerSnapshot === 'it'
          ? WORKFLOW_ACTIONS.purchaseReceiptInspectIt
          : WORKFLOW_ACTIONS.purchaseReceiptInspectProcurement;

      authorization.assertAction(actor, action);
      authorization.assertManagementOwner(
        actor,
        context.managementOwnerSnapshot,
      );

      if (context.inspectionResult !== 'pending') {
        const [asset] = await tx
          .select({
            id: schema.assets.id,
            assetCode: schema.assets.assetCode,
            qrCode: schema.assets.qrCode,
          })
          .from(schema.assets)
          .where(eq(schema.assets.purchaseReceiptUnitId, unitId));

        return { unitId, inspectionResult: context.inspectionResult, asset };
      }

      const now = new Date();
      let evidenceAttachmentId: string | null = null;

      if (evidence) {
        const [attachment] = await tx
          .insert(schema.attachments)
          .values({
            entityType: 'purchase_receipt_unit',
            entityId: unitId,
            fileName: evidence.originalname,
            url: `/uploads/purchase-receipts/${evidence.filename}`,
            mimeType: evidence.mimetype,
            size: evidence.size,
            uploadedByEmployeeId: actor.id,
          })
          .returning({ id: schema.attachments.id });

        evidenceAttachmentId = attachment.id;
        evidenceSaved = true;
      }

      const inspectionResult = dto.accepted ? 'accepted' : 'rejected';

      await tx
        .update(schema.purchaseReceiptUnits)
        .set({
          inspectionResult,
          inspectedBy: actor.id,
          inspectedAt: now,
          rejectionReason: dto.accepted ? null : dto.reason,
          evidenceAttachmentId,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.purchaseReceiptUnits.id, unitId));

      let asset: { id: string; assetCode: string; qrCode: string } | undefined;

      if (dto.accepted && context.trackingModeSnapshot === 'individual_asset') {
        const assetId = randomUUID();
        const assetCode = createAssetCode(assetId);
        const [createdAsset] = await tx
          .insert(schema.assets)
          .values({
            id: assetId,
            assetCode,
            qrCode: `asset:${assetId}`,
            assetCategoryId: context.assetCategoryId,
            supplierId: context.supplierId,
            purchaseOrderItemId: context.purchaseOrderItemId,
            purchaseReceiptUnitId: unitId,
            name: context.itemNameSnapshot,
            currentValue: context.unitPriceExclVat,
            status: 'awaiting_allocation',
            initialValue: context.unitPriceExclVat,
            purchaseDate: context.orderDate,
            inServiceDate: context.deliveryDate,
            createdBy: actor.id,
            updatedBy: actor.id,
          })
          .returning({
            id: schema.assets.id,
            assetCode: schema.assets.assetCode,
            qrCode: schema.assets.qrCode,
          });

        asset = createdAsset;
      }

      await refreshReceiptItem(tx, context.purchaseReceiptItemId, actor.id);
      const receiptStatus = await refreshReceipt(
        tx,
        context.receiptId,
        actor.id,
      );
      const orderStatus = await refreshOrder(
        tx,
        context.purchaseOrderId,
        actor.id,
      );

      await audit.logPurchase(tx, {
        requestId: context.purchaseRequestId,
        revision: context.requestRevision,
        actionType: dto.accepted
          ? 'purchase.receipt.accept_unit'
          : 'purchase.receipt.reject_unit',
        actor,
        result: dto.accepted ? 'approved' : 'rejected',
        previousStatus: context.receiptStatus,
        newStatus: receiptStatus,
        reason: dto.reason,
        entityType: 'receipt',
        entityId: context.receiptId,
        metadata: {
          unitId,
          purchaseOrderId: context.purchaseOrderId,
          orderStatus,
          note: dto.note,
          assetId: asset?.id,
        },
      });

      if (asset) {
        const departmentHeads = await tx
          .select({ id: schema.employees.id })
          .from(schema.employees)
          .where(
            and(
              eq(schema.employees.departmentId, context.requestDepartmentId),
              eq(schema.employees.isDepartmentHead, true),
              eq(schema.employees.isActive, true),
            ),
          );

        await notifications.createMany(
          tx,
          departmentHeads.map((head) => ({
            recipientId: head.id,
            eventType: 'asset_pending_initial_allocation' as const,
            entityType: 'asset' as const,
            entityId: asset.id,
            title: 'Tài sản chờ cấp phát',
            body: `${asset.assetCode} đã kiểm tra đạt và đang chờ cấp phát.`,
            metadata: { purchaseRequestId: context.purchaseRequestId },
          })),
        );
      }

      if (receiptStatus === 'inspected') {
        await notifications.create(tx, {
          recipientId: context.recordedBy,
          eventType: 'purchase_receipt_inspection_completed',
          entityType: 'receipt',
          entityId: context.receiptId,
          title: 'Đợt giao đã kiểm tra xong',
          body: `${context.receiptCode} đã hoàn tất kiểm tra.`,
          metadata: { purchaseOrderId: context.purchaseOrderId },
        });
      }

      if (!dto.accepted) {
        await notifications.create(tx, {
          recipientId: context.recordedBy,
          eventType: 'purchase_receipt_has_rejected_items',
          entityType: 'receipt',
          entityId: context.receiptId,
          title: 'Đợt giao có hàng không đạt',
          body: `${context.receiptCode} có hàng không đạt: ${dto.reason}`,
          metadata: { purchaseOrderId: context.purchaseOrderId, unitId },
        });
      }

      return { unitId, inspectionResult, asset };
    });

    if (evidence && !evidenceSaved) await removeUploadedFiles([evidence]);

    return result;
  } catch (error) {
    if (evidence) await removeUploadedFiles([evidence]);

    throw error;
  }
}

export async function refreshReceiptItem(
  db: Database,
  receiptItemId: string,
  actorId: string,
) {
  const [counts] = await db
    .select({
      accepted: sql<number>`count(*) filter (where ${schema.purchaseReceiptUnits.inspectionResult} = 'accepted')::int`,
      rejected: sql<number>`count(*) filter (where ${schema.purchaseReceiptUnits.inspectionResult} = 'rejected')::int`,
    })
    .from(schema.purchaseReceiptUnits)
    .where(
      eq(schema.purchaseReceiptUnits.purchaseReceiptItemId, receiptItemId),
    );
  const inspected = counts.accepted + counts.rejected;
  const [item] = await db
    .select({
      deliveredQuantity: schema.purchaseReceiptItems.deliveredQuantity,
    })
    .from(schema.purchaseReceiptItems)
    .where(eq(schema.purchaseReceiptItems.id, receiptItemId));

  let inspectionResult: typeof schema.purchaseReceiptItems.$inferSelect.inspectionResult =
    'pending';

  if (inspected > 0 && inspected === item.deliveredQuantity) {
    inspectionResult = counts.rejected === 0 ? 'accepted' : 'rejected';
  }

  await db
    .update(schema.purchaseReceiptItems)
    .set({
      acceptedQuantity: counts.accepted,
      rejectedQuantity: counts.rejected,
      inspectionResult,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .where(eq(schema.purchaseReceiptItems.id, receiptItemId));
}

export async function refreshReceipt(
  db: Database,
  receiptId: string,
  actorId: string,
) {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      decided: sql<number>`count(*) filter (where ${schema.purchaseReceiptUnits.inspectionResult} <> 'pending')::int`,
    })
    .from(schema.purchaseReceiptUnits)
    .innerJoin(
      schema.purchaseReceiptItems,
      eq(
        schema.purchaseReceiptUnits.purchaseReceiptItemId,
        schema.purchaseReceiptItems.id,
      ),
    )
    .where(eq(schema.purchaseReceiptItems.purchaseReceiptId, receiptId));
  const status =
    counts.decided === counts.total
      ? 'inspected'
      : counts.decided > 0
        ? 'inspecting'
        : 'pending_inspection';
  const now = new Date();

  await db
    .update(schema.purchaseReceipts)
    .set({
      status,
      inspectedAt: status === 'inspected' ? now : null,
      inspectedBy: status === 'inspected' ? actorId : null,
      updatedAt: now,
      updatedBy: actorId,
    })
    .where(eq(schema.purchaseReceipts.id, receiptId));

  return status;
}

export async function refreshOrder(
  db: Database,
  orderId: string,
  actorId: string,
) {
  const items = await loadOrderItems(db, orderId);
  const progress = await loadOrderProgress(db, items);
  const lines = [...progress.values()];
  const status = lines.every((line) => line.accepted >= line.ordered)
    ? 'fully_received'
    : lines.some((line) => line.accepted > 0)
      ? 'partially_received'
      : 'issued';

  await db
    .update(schema.purchaseOrders)
    .set({ status, updatedAt: new Date(), updatedBy: actorId })
    .where(eq(schema.purchaseOrders.id, orderId));

  return status;
}

export function createAssetCode(assetId: string) {
  return `AST-${new Date().getFullYear()}-${assetId.slice(0, 8).toUpperCase()}`;
}
