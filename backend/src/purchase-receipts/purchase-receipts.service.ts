import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { removeUploadedFiles } from '../attachments/upload-cleanup.js';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  CloseShortPurchaseOrderDto,
  InspectPurchaseReceiptUnitDto,
  RecordPurchaseReceiptDto,
} from './dto/purchase-receipt.dto.js';
import { validateReceiptSerialNumbers } from './purchase-receipt-calculations.js';
import { inspectUnit } from './purchase-receipt-inspection.js';
import {
  findInspectionQueue,
  findOne,
  findOrderProgress,
  loadOrderItems,
  loadOrderProgress,
  lockOrder,
  requireOrderContext,
} from './purchase-receipt-queries.js';

type Database = NodePgDatabase<typeof schema>;
type ManagementOwner =
  (typeof schema.assetManagementOwnerEnum.enumValues)[number];
type ReceiptFiles = Partial<
  Record<'deliveryNote' | 'invoice' | 'warranty', Express.Multer.File[]>
>;
@Injectable()
export class PurchaseReceiptsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly authorization: PurchaseAuthorizationService,
    private readonly audit: RequestAuditService,
    private readonly notifications: NotificationsService,
  ) {}
  findInspectionQueue(actor: AuthenticatedEmployee) {
    return findInspectionQueue(this.authorization, this.db, actor);
  }

  findOrderProgress(orderId: string, actor: AuthenticatedEmployee) {
    return findOrderProgress(this.authorization, this.db, orderId, actor);
  }

  inspectUnit(
    unitId: string,
    dto: InspectPurchaseReceiptUnitDto,
    evidence: Express.Multer.File | undefined,
    actor: AuthenticatedEmployee,
  ) {
    return inspectUnit(
      this.audit,
      this.authorization,
      this.db,
      this.notifications,
      unitId,
      dto,
      evidence,
      actor,
    );
  }

  findOne(id: string, actor: AuthenticatedEmployee) {
    return findOne(this.authorization, this.db, id, actor);
  }
  async record(
    orderId: string,
    dto: RecordPurchaseReceiptDto,
    files: ReceiptFiles,
    actor: AuthenticatedEmployee,
  ) {
    this.assertProcurementAction(actor, WORKFLOW_ACTIONS.purchaseReceiptRecord);
    const deliveryNote = files.deliveryNote?.[0];

    if (!deliveryNote) {
      await this.removeFiles(files);
      throw new BadRequestException('Ảnh phiếu giao hàng là bắt buộc.');
    }

    const receiptId = randomUUID();

    try {
      await this.db.transaction(async (tx) => {
        await lockOrder(tx, orderId);
        const context = await requireOrderContext(tx, orderId, [
          'issued',
          'partially_received',
        ]);
        const orderItems = await loadOrderItems(tx, orderId);
        const inputIds = dto.items.map((item) => item.purchaseOrderItemId);

        if (new Set(inputIds).size !== inputIds.length) {
          throw new BadRequestException(
            'Mỗi hạng mục PO chỉ được xuất hiện một lần trong đợt giao.',
          );
        }

        const inputById = new Map(
          dto.items.map((item) => [item.purchaseOrderItemId, item]),
        );
        const selectedItems = orderItems.filter((item) =>
          inputById.has(item.id),
        );

        if (selectedItems.length !== dto.items.length) {
          throw new BadRequestException(
            'Đợt giao chứa hạng mục không thuộc PO.',
          );
        }

        const progress = await loadOrderProgress(tx, orderItems);
        const serialsByItemId = new Map<string, string[]>();

        for (const item of selectedItems) {
          const input = inputById.get(item.id)!;
          const line = progress.get(item.id)!;

          if (input.deliveredQuantity > line.remaining) {
            throw new ConflictException(
              `${item.itemNameSnapshot} chỉ còn có thể nhận ${line.remaining}.`,
            );
          }

          serialsByItemId.set(
            item.id,
            validateReceiptSerialNumbers(
              input.serialNumbers,
              input.deliveredQuantity,
              item.trackingModeSnapshot === 'individual_asset',
              item.itemNameSnapshot,
            ),
          );
        }

        const submittedSerials = [...serialsByItemId.values()].flat();

        if (new Set(submittedSerials).size !== submittedSerials.length) {
          throw new BadRequestException(
            'Một mã sản phẩm không được dùng cho nhiều hạng mục.',
          );
        }

        if (submittedSerials.length > 0) {
          const existingSerials = await tx
            .select({ serialNumber: schema.purchaseReceiptUnits.serialNumber })
            .from(schema.purchaseReceiptUnits)
            .where(
              inArray(
                schema.purchaseReceiptUnits.serialNumber,
                submittedSerials,
              ),
            );

          if (existingSerials.length > 0) {
            throw new ConflictException(
              `Mã sản phẩm ${existingSerials[0].serialNumber} đã được ghi nhận.`,
            );
          }
        }

        const attachmentIds = await this.insertReceiptAttachments(
          tx,
          receiptId,
          files,
          actor.id,
        );

        await tx.insert(schema.purchaseReceipts).values({
          id: receiptId,
          receiptCode: this.createReceiptCode(),
          purchaseOrderId: orderId,
          deliveryDate: dto.deliveryDate,
          deliveryNoteNumber: dto.deliveryNoteNumber.trim(),
          deliveryNoteAttachmentId: attachmentIds.deliveryNote,
          invoiceAttachmentId: attachmentIds.invoice,
          warrantyAttachmentId: attachmentIds.warranty,
          recordedBy: actor.id,
          createdBy: actor.id,
          updatedBy: actor.id,
        });

        for (const item of selectedItems) {
          const input = inputById.get(item.id)!;
          const [receiptItem] = await tx
            .insert(schema.purchaseReceiptItems)
            .values({
              purchaseReceiptId: receiptId,
              purchaseOrderItemId: item.id,
              deliveredQuantity: input.deliveredQuantity,
              managementOwnerSnapshot: item.managementOwnerSnapshot,
              trackingModeSnapshot: item.trackingModeSnapshot,
              createdBy: actor.id,
              updatedBy: actor.id,
            })
            .returning({ id: schema.purchaseReceiptItems.id });

          await tx.insert(schema.purchaseReceiptUnits).values(
            Array.from({ length: input.deliveredQuantity }, (_, index) => ({
              purchaseReceiptItemId: receiptItem.id,
              sequenceNumber: index + 1,
              serialNumber: serialsByItemId.get(item.id)?.[index] ?? null,
              createdBy: actor.id,
              updatedBy: actor.id,
            })),
          );
        }

        await this.audit.logPurchase(tx, {
          requestId: context.purchaseRequestId,
          revision: context.requestRevision,
          actionType: 'purchase.receipt.record',
          actor,
          result: 'pending',
          previousStatus: context.status,
          newStatus: context.status,
          entityType: 'receipt',
          entityId: receiptId,
          metadata: { purchaseOrderId: orderId },
        });
        await this.notifyInspectors(
          tx,
          receiptId,
          selectedItems.map((item) => item.managementOwnerSnapshot),
        );
      });
    } catch (error) {
      await this.removeFiles(files);
      throw error;
    }

    return findOne(this.authorization, this.db, receiptId, actor);
  }

  async closeShort(
    orderId: string,
    dto: CloseShortPurchaseOrderDto,
    actor: AuthenticatedEmployee,
  ) {
    this.assertProcurementAction(
      actor,
      WORKFLOW_ACTIONS.purchaseReceiptCloseShort,
    );

    await this.db.transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await requireOrderContext(tx, orderId, [
        'issued',
        'partially_received',
      ]);
      const items = await loadOrderItems(tx, orderId);
      const progress = await loadOrderProgress(tx, items);

      if ([...progress.values()].some((line) => line.pending > 0)) {
        throw new ConflictException(
          'Không thể đóng thiếu khi vẫn còn đơn vị chờ kiểm tra.',
        );
      }

      if (
        [...progress.values()].every((line) => line.accepted >= line.ordered)
      ) {
        throw new ConflictException('PO đã nhận đủ, không thể đóng thiếu.');
      }

      const now = new Date();

      await tx
        .update(schema.purchaseOrders)
        .set({
          status: 'closed_short',
          cancelledAt: now,
          cancelledBy: actor.id,
          cancellationReason: dto.reason.trim(),
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.purchaseOrders.id, orderId));
      await this.audit.logPurchase(tx, {
        requestId: order.purchaseRequestId,
        revision: order.requestRevision,
        actionType: 'purchase.receipt.close_short',
        actor,
        result: 'approved',
        previousStatus: order.status,
        newStatus: 'closed_short',
        reason: dto.reason,
        entityType: 'order',
        entityId: orderId,
      });
    });

    return { id: orderId, status: 'closed_short' };
  }

  private async insertReceiptAttachments(
    db: Database,
    receiptId: string,
    files: ReceiptFiles,
    actorId: string,
  ) {
    const entries: Array<[string, Express.Multer.File]> = [];

    if (files.deliveryNote?.[0]) {
      entries.push(['deliveryNote', files.deliveryNote[0]]);
    }

    if (files.invoice?.[0]) entries.push(['invoice', files.invoice[0]]);

    if (files.warranty?.[0]) entries.push(['warranty', files.warranty[0]]);

    const inserted = await db
      .insert(schema.attachments)
      .values(
        entries.map(([kind, file]) => ({
          entityType: `purchase_receipt_${kind}`,
          entityId: receiptId,
          fileName: file.originalname,
          url: `/uploads/purchase-receipts/${file.filename}`,
          mimeType: file.mimetype,
          size: file.size,
          uploadedByEmployeeId: actorId,
        })),
      )
      .returning({
        id: schema.attachments.id,
        entityType: schema.attachments.entityType,
      });
    const byType = new Map(inserted.map((item) => [item.entityType, item.id]));

    return {
      deliveryNote: byType.get('purchase_receipt_deliveryNote')!,
      invoice: byType.get('purchase_receipt_invoice') ?? null,
      warranty: byType.get('purchase_receipt_warranty') ?? null,
    };
  }

  private async notifyInspectors(
    db: Database,
    receiptId: string,
    owners: ManagementOwner[],
  ) {
    const departmentNames = [
      ...new Set(owners.map((owner) => owner.toUpperCase())),
    ];
    const recipients = await db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .innerJoin(
        schema.departments,
        eq(schema.employees.departmentId, schema.departments.id),
      )
      .where(
        and(
          inArray(schema.departments.name, departmentNames),
          eq(schema.employees.isActive, true),
        ),
      );

    await this.notifications.createMany(
      db,
      recipients.map((recipient) => ({
        recipientId: recipient.id,
        eventType: 'purchase_receipt_pending_inspection',
        entityType: 'receipt' as const,
        entityId: receiptId,
        title: 'Đợt giao chờ kiểm tra',
        body: 'Có hàng mới thuộc phạm vi của bạn đang chờ kiểm tra.',
      })),
    );
  }

  private assertProcurementAction(
    actor: AuthenticatedEmployee,
    action:
      | typeof WORKFLOW_ACTIONS.purchaseReceiptRecord
      | typeof WORKFLOW_ACTIONS.purchaseReceiptCloseShort,
  ) {
    this.authorization.assertAction(actor, action);
    this.authorization.assertDepartment(actor, 'PROCUREMENT');
  }

  private createReceiptCode() {
    return `RCV-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private async removeFiles(files: ReceiptFiles) {
    await removeUploadedFiles(
      Object.values(files).flatMap((entries) => entries ?? []),
    );
  }
}

export {
  calculateReceiptProgress,
  validateReceiptSerialNumbers,
  type ReceiptProgressLine,
} from './purchase-receipt-calculations.js';
