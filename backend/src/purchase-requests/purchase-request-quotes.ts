import { BadRequestException, ConflictException } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { removeUploadedFiles } from '../attachments/upload-cleanup.js';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { CreatePurchaseQuoteDto } from './dto/purchase-request.dto.js';

import {
  loadRevisionItems,
  requireCurrentRevision,
  requireRequest,
} from './purchase-request-queries.js';

type Database = NodePgDatabase<typeof schema>;

/** Saves an uploaded quote and its audit entry in one transaction. */
export async function addQuote(
  db: Database,
  authorization: PurchaseAuthorizationService,
  audit: RequestAuditService,
  id: string,
  dto: CreatePurchaseQuoteDto,
  file: Express.Multer.File | undefined,
  actor: AuthenticatedEmployee,
) {
  authorization.assertAction(
    actor,
    WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
  );
  authorization.assertDepartment(actor, 'PROCUREMENT');

  if (!file) throw new BadRequestException('Ảnh báo giá là bắt buộc.');

  try {
    await db.transaction(async (tx) => {
      const request = await requireRequest(tx, id, [
        'pending_procurement_enrichment',
      ]);
      const revision = await requireCurrentRevision(tx, request);
      const [item] = await tx
        .select({ id: schema.purchaseRequestItems.id })
        .from(schema.purchaseRequestItems)
        .where(
          and(
            eq(schema.purchaseRequestItems.id, dto.requestItemId),
            eq(schema.purchaseRequestItems.requestRevisionId, revision.id),
          ),
        );

      if (!item) {
        throw new BadRequestException(
          'Hạng mục không thuộc revision hiện tại.',
        );
      }

      const [supplier] = await tx
        .select({ id: schema.suppliers.id })
        .from(schema.suppliers)
        .where(eq(schema.suppliers.id, dto.supplierId));

      if (!supplier)
        throw new BadRequestException('Nhà cung cấp không tồn tại.');

      const [existingQuote] = await tx
        .select({ id: schema.purchaseRequestQuotes.id })
        .from(schema.purchaseRequestQuotes)
        .where(
          and(
            eq(schema.purchaseRequestQuotes.requestItemId, item.id),
            eq(schema.purchaseRequestQuotes.supplierId, dto.supplierId),
          ),
        );

      if (existingQuote) {
        throw new ConflictException(
          'Hạng mục đã có báo giá của nhà cung cấp này.',
        );
      }

      if (dto.isSelected) {
        await tx
          .update(schema.purchaseRequestQuotes)
          .set({
            isSelected: false,
            updatedAt: new Date(),
            updatedBy: actor.id,
          })
          .where(eq(schema.purchaseRequestQuotes.requestItemId, item.id));
      }

      const [attachment] = await tx
        .insert(schema.attachments)
        .values({
          entityType: 'purchase_request_item',
          entityId: item.id,
          fileName: file.originalname,
          url: `/uploads/purchase-quotes/${file.filename}`,
          mimeType: file.mimetype,
          size: file.size,
          uploadedByEmployeeId: actor.id,
        })
        .returning();

      await tx.insert(schema.purchaseRequestQuotes).values({
        requestItemId: item.id,
        supplierId: dto.supplierId,
        attachmentId: attachment.id,
        unitPriceExclVat: dto.unitPriceExclVat,
        vatRate: dto.vatRate,
        isSelected: dto.isSelected,
        note: dto.note,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      await audit.logPurchase(tx, {
        requestId: id,
        revision: request.currentRevision,
        actionType: 'purchase.request.add_quote',
        actor,
        result: 'pending',
        previousStatus: request.status,
        newStatus: request.status,
        entityType: 'request',
        entityId: id,
        metadata: { requestItemId: item.id, supplierId: dto.supplierId },
      });
    });
  } catch (error) {
    await removeUploadedFiles([file]);
    throw error;
  }
}

/** Requires a selected quote for every item and returns the validated revision and items. */
export async function requireCommercialData(
  db: Database,
  request: typeof schema.purchaseRequests.$inferSelect,
) {
  const revision = await requireCurrentRevision(db, request);
  const items = await loadRevisionItems(db, revision.id);
  const quotes = await db
    .select({
      requestItemId: schema.purchaseRequestQuotes.requestItemId,
      isSelected: schema.purchaseRequestQuotes.isSelected,
    })
    .from(schema.purchaseRequestQuotes)
    .where(
      inArray(
        schema.purchaseRequestQuotes.requestItemId,
        items.map((item) => item.id),
      ),
    );
  const selectedItemIds = new Set(
    quotes
      .filter((quote) => quote.isSelected)
      .map((quote) => quote.requestItemId),
  );
  const incomplete = items.some((item) => !selectedItemIds.has(item.id));

  if (incomplete) {
    throw new BadRequestException(
      'Mỗi hạng mục phải có ít nhất một báo giá và một báo giá được chọn.',
    );
  }

  return { revision, items };
}
