import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
} from '../auth/workflow-actions.config.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  CloseShortPurchaseOrderDto,
  InspectPurchaseReceiptUnitDto,
  RecordPurchaseReceiptDto,
} from './dto/purchase-receipt.dto.js';

type Database = NodePgDatabase<typeof schema>;
type ManagementOwner = (typeof schema.assetManagementOwnerEnum.enumValues)[number];
type ReceiptFiles = Partial<
  Record<'deliveryNote' | 'invoice' | 'warranty', Express.Multer.File[]>
>;

export interface ReceiptProgressLine {
  ordered: number;
  delivered: number;
  accepted: number;
  rejected: number;
  pending: number;
  remaining: number;
}

export function calculateReceiptProgress(
  ordered: number,
  delivered: number,
  accepted: number,
  rejected: number,
): ReceiptProgressLine {
  const pending = delivered - accepted - rejected;

  return {
    ordered,
    delivered,
    accepted,
    rejected,
    pending,
    remaining: ordered - accepted - pending,
  };
}

@Injectable()
export class PurchaseReceiptsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly authorization: PurchaseAuthorizationService,
    private readonly audit: RequestAuditService,
    private readonly notifications: NotificationsService,
  ) {}

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
      await this.db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;

        await this.lockOrder(tx, orderId);
        const context = await this.requireOrderContext(tx, orderId, [
          'issued',
          'partially_received',
        ]);
        const orderItems = await this.loadOrderItems(tx, orderId);
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
          throw new BadRequestException('Đợt giao chứa hạng mục không thuộc PO.');
        }

        const progress = await this.loadOrderProgress(tx, orderItems);

        for (const item of selectedItems) {
          const input = inputById.get(item.id)!;
          const line = progress.get(item.id)!;

          if (input.deliveredQuantity > line.remaining) {
            throw new ConflictException(
              `${item.itemNameSnapshot} chỉ còn có thể nhận ${line.remaining}.`,
            );
          }

          if ((input.serialNumbers?.length ?? 0) > input.deliveredQuantity) {
            throw new BadRequestException(
              `Số serial của ${item.itemNameSnapshot} vượt số lượng giao.`,
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
              serialNumber: input.serialNumbers?.[index]?.trim() || null,
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

    return this.findOne(receiptId, actor);
  }

  async findInspectionQueue(actor: AuthenticatedEmployee) {
    const owner = this.inspectionOwner(actor);

    return this.db
      .select({
        unitId: schema.purchaseReceiptUnits.id,
        receiptId: schema.purchaseReceipts.id,
        receiptCode: schema.purchaseReceipts.receiptCode,
        deliveryDate: schema.purchaseReceipts.deliveryDate,
        purchaseOrderId: schema.purchaseOrders.id,
        purchaseOrderCode: schema.purchaseOrders.purchaseOrderCode,
        itemName: schema.purchaseOrderItems.itemNameSnapshot,
        trackingMode: schema.purchaseReceiptItems.trackingModeSnapshot,
        sequenceNumber: schema.purchaseReceiptUnits.sequenceNumber,
        serialNumber: schema.purchaseReceiptUnits.serialNumber,
      })
      .from(schema.purchaseReceiptUnits)
      .innerJoin(
        schema.purchaseReceiptItems,
        eq(
          schema.purchaseReceiptUnits.purchaseReceiptItemId,
          schema.purchaseReceiptItems.id,
        ),
      )
      .innerJoin(
        schema.purchaseReceipts,
        eq(
          schema.purchaseReceiptItems.purchaseReceiptId,
          schema.purchaseReceipts.id,
        ),
      )
      .innerJoin(
        schema.purchaseOrderItems,
        eq(
          schema.purchaseReceiptItems.purchaseOrderItemId,
          schema.purchaseOrderItems.id,
        ),
      )
      .innerJoin(
        schema.purchaseOrders,
        eq(schema.purchaseOrderItems.purchaseOrderId, schema.purchaseOrders.id),
      )
      .where(
        and(
          eq(schema.purchaseReceiptUnits.inspectionResult, 'pending'),
          eq(schema.purchaseReceiptItems.managementOwnerSnapshot, owner),
        ),
      )
      .orderBy(
        asc(schema.purchaseReceipts.createdAt),
        asc(schema.purchaseReceiptItems.createdAt),
        asc(schema.purchaseReceiptUnits.sequenceNumber),
      );
  }

  async findOrderProgress(orderId: string, actor: AuthenticatedEmployee) {
    const context = await this.requireOrderContext(this.db, orderId, [
      'issued',
      'partially_received',
      'fully_received',
      'closed_short',
    ]);

    await this.authorization.assertCanViewRequest(
      context.purchaseRequestId,
      actor,
    );
    const items = await this.loadOrderItems(this.db, orderId);
    const progress = await this.loadOrderProgress(this.db, items);

    return items.map((item) => ({
      purchaseOrderItemId: item.id,
      itemName: item.itemNameSnapshot,
      trackingMode: item.trackingModeSnapshot,
      managementOwner: item.managementOwnerSnapshot,
      ...progress.get(item.id),
    }));
  }

  async inspectUnit(
    unitId: string,
    dto: InspectPurchaseReceiptUnitDto,
    evidence: Express.Multer.File | undefined,
    actor: AuthenticatedEmployee,
  ) {
    try {
      const result = await this.db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;

        await tx.execute(
          sql`select id from purchase_receipt_units where id = ${unitId} for update`,
        );
        const context = await this.requireUnitContext(tx, unitId);
        const action =
          context.managementOwnerSnapshot === 'it'
            ? WORKFLOW_ACTIONS.purchaseReceiptInspectIt
            : WORKFLOW_ACTIONS.purchaseReceiptInspectProcurement;

        this.authorization.assertAction(actor, action);
        this.authorization.assertManagementOwner(
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

        let asset:
          | { id: string; assetCode: string; qrCode: string }
          | undefined;

        if (
          dto.accepted &&
          context.trackingModeSnapshot === 'individual_asset'
        ) {
          const [managingDepartment] = await tx
            .select({ id: schema.departments.id })
            .from(schema.departments)
            .where(
              eq(
                schema.departments.name,
                context.managementOwnerSnapshot.toUpperCase(),
              ),
            );

          if (!managingDepartment) {
            throw new ConflictException(
              'Không tìm thấy bộ phận quản lý tài sản.',
            );
          }

          const assetId = randomUUID();
          const assetCode = this.createAssetCode(assetId);
          const [createdAsset] = await tx
            .insert(schema.assets)
            .values({
              id: assetId,
              assetCode,
              qrCode: `asset:${assetId}`,
              assetCategoryId: context.assetCategoryId,
              supplierId: context.supplierId,
              currentManagingDepartmentId: managingDepartment.id,
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

        await this.refreshReceiptItem(tx, context.purchaseReceiptItemId, actor.id);
        const receiptStatus = await this.refreshReceipt(tx, context.receiptId, actor.id);
        const orderStatus = await this.refreshOrder(tx, context.purchaseOrderId, actor.id);

        await this.audit.logPurchase(tx, {
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
          await this.notifications.create(tx, {
            recipientId: context.requesterId,
            eventType: 'asset_pending_initial_allocation',
            entityType: 'asset',
            entityId: asset.id,
            title: 'Tài sản chờ cấp phát',
            body: `${asset.assetCode} đã kiểm tra đạt và đang chờ cấp phát.`,
            metadata: { purchaseRequestId: context.purchaseRequestId },
          });
        }

        if (receiptStatus === 'inspected') {
          await this.notifications.create(tx, {
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
          await this.notifications.create(tx, {
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

      return result;
    } catch (error) {
      if (evidence) await unlink(evidence.path).catch(() => undefined);

      throw error;
    }
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

    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockOrder(tx, orderId);
      const order = await this.requireOrderContext(tx, orderId, [
        'issued',
        'partially_received',
      ]);
      const items = await this.loadOrderItems(tx, orderId);
      const progress = await this.loadOrderProgress(tx, items);

      if ([...progress.values()].some((line) => line.pending > 0)) {
        throw new ConflictException(
          'Không thể đóng thiếu khi vẫn còn đơn vị chờ kiểm tra.',
        );
      }

      if ([...progress.values()].every((line) => line.accepted >= line.ordered)) {
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

  async findOne(id: string, actor: AuthenticatedEmployee) {
    const [receipt] = await this.db
      .select({
        receipt: schema.purchaseReceipts,
        purchaseRequestId: schema.purchaseOrders.purchaseRequestId,
        purchaseOrderCode: schema.purchaseOrders.purchaseOrderCode,
      })
      .from(schema.purchaseReceipts)
      .innerJoin(
        schema.purchaseOrders,
        eq(schema.purchaseReceipts.purchaseOrderId, schema.purchaseOrders.id),
      )
      .where(eq(schema.purchaseReceipts.id, id));

    if (!receipt) throw new NotFoundException('Không tìm thấy đợt giao hàng.');

    await this.authorization.assertCanViewRequest(
      receipt.purchaseRequestId,
      actor,
    );

    const items = await this.db
      .select({
        id: schema.purchaseReceiptItems.id,
        itemName: schema.purchaseOrderItems.itemNameSnapshot,
        deliveredQuantity: schema.purchaseReceiptItems.deliveredQuantity,
        acceptedQuantity: schema.purchaseReceiptItems.acceptedQuantity,
        rejectedQuantity: schema.purchaseReceiptItems.rejectedQuantity,
        managementOwner: schema.purchaseReceiptItems.managementOwnerSnapshot,
        trackingMode: schema.purchaseReceiptItems.trackingModeSnapshot,
      })
      .from(schema.purchaseReceiptItems)
      .innerJoin(
        schema.purchaseOrderItems,
        eq(
          schema.purchaseReceiptItems.purchaseOrderItemId,
          schema.purchaseOrderItems.id,
        ),
      )
      .where(eq(schema.purchaseReceiptItems.purchaseReceiptId, id));

    return {
      id,
      status: receipt.receipt.status,
      allowedActions: this.allowedReceiptActions(actor),
      data: {
        ...receipt.receipt,
        purchaseOrderCode: receipt.purchaseOrderCode,
        items: items.map((item) => ({
          ...item,
          pendingQuantity:
            item.deliveredQuantity -
            item.acceptedQuantity -
            item.rejectedQuantity,
        })),
      },
    };
  }

  private async loadOrderItems(db: Database, orderId: string) {
    return db
      .select({
        id: schema.purchaseOrderItems.id,
        purchaseRequestItemId: schema.purchaseOrderItems.purchaseRequestItemId,
        itemNameSnapshot: schema.purchaseOrderItems.itemNameSnapshot,
        quantity: schema.purchaseOrderItems.quantity,
        unitPriceExclVat: schema.purchaseOrderItems.unitPriceExclVat,
        assetCategoryId: schema.purchaseRequestItems.assetCategoryId,
        managementOwnerSnapshot:
          schema.purchaseRequestItems.managementOwnerSnapshot,
        trackingModeSnapshot: schema.purchaseRequestItems.trackingModeSnapshot,
      })
      .from(schema.purchaseOrderItems)
      .innerJoin(
        schema.purchaseRequestItems,
        eq(
          schema.purchaseOrderItems.purchaseRequestItemId,
          schema.purchaseRequestItems.id,
        ),
      )
      .where(eq(schema.purchaseOrderItems.purchaseOrderId, orderId));
  }

  private async loadOrderProgress(
    db: Database,
    items: Awaited<ReturnType<PurchaseReceiptsService['loadOrderItems']>>,
  ) {
    if (items.length === 0) return new Map<string, ReceiptProgressLine>();

    const rows = await db
      .select({
        purchaseOrderItemId: schema.purchaseReceiptItems.purchaseOrderItemId,
        delivered: sql<number>`coalesce(sum(${schema.purchaseReceiptItems.deliveredQuantity}), 0)::int`,
        accepted: sql<number>`coalesce(sum(${schema.purchaseReceiptItems.acceptedQuantity}), 0)::int`,
        rejected: sql<number>`coalesce(sum(${schema.purchaseReceiptItems.rejectedQuantity}), 0)::int`,
      })
      .from(schema.purchaseReceiptItems)
      .where(
        inArray(
          schema.purchaseReceiptItems.purchaseOrderItemId,
          items.map((item) => item.id),
        ),
      )
      .groupBy(schema.purchaseReceiptItems.purchaseOrderItemId);
    const totals = new Map(rows.map((row) => [row.purchaseOrderItemId, row]));

    return new Map(
      items.map((item) => {
        const total = totals.get(item.id);

        return [
          item.id,
          calculateReceiptProgress(
            item.quantity,
            total?.delivered ?? 0,
            total?.accepted ?? 0,
            total?.rejected ?? 0,
          ),
        ];
      }),
    );
  }

  private async requireOrderContext(
    db: Database,
    orderId: string,
    statuses: Array<typeof schema.purchaseOrders.$inferSelect.status>,
  ) {
    const [order] = await db
      .select({
        id: schema.purchaseOrders.id,
        status: schema.purchaseOrders.status,
        purchaseRequestId: schema.purchaseOrders.purchaseRequestId,
        requestRevision: schema.purchaseRequestRevisions.revisionNumber,
        supplierId: schema.purchaseOrders.supplierId,
      })
      .from(schema.purchaseOrders)
      .innerJoin(
        schema.purchaseRequestRevisions,
        eq(
          schema.purchaseOrders.requestRevisionId,
          schema.purchaseRequestRevisions.id,
        ),
      )
      .where(eq(schema.purchaseOrders.id, orderId));

    if (!order) throw new NotFoundException('Không tìm thấy đơn đặt mua.');

    if (!statuses.includes(order.status)) {
      throw new ConflictException('Trạng thái PO không cho phép thao tác này.');
    }

    return order;
  }

  private async requireUnitContext(db: Database, unitId: string) {
    const [context] = await db
      .select({
        inspectionResult: schema.purchaseReceiptUnits.inspectionResult,
        purchaseReceiptItemId: schema.purchaseReceiptItems.id,
        managementOwnerSnapshot:
          schema.purchaseReceiptItems.managementOwnerSnapshot,
        trackingModeSnapshot: schema.purchaseReceiptItems.trackingModeSnapshot,
        receiptId: schema.purchaseReceipts.id,
        receiptCode: schema.purchaseReceipts.receiptCode,
        receiptStatus: schema.purchaseReceipts.status,
        deliveryDate: schema.purchaseReceipts.deliveryDate,
        recordedBy: schema.purchaseReceipts.recordedBy,
        purchaseOrderId: schema.purchaseOrders.id,
        purchaseRequestId: schema.purchaseOrders.purchaseRequestId,
        requestRevision: schema.purchaseRequestRevisions.revisionNumber,
        supplierId: schema.purchaseOrders.supplierId,
        orderDate: schema.purchaseOrders.orderDate,
        purchaseOrderItemId: schema.purchaseOrderItems.id,
        itemNameSnapshot: schema.purchaseOrderItems.itemNameSnapshot,
        unitPriceExclVat: schema.purchaseOrderItems.unitPriceExclVat,
        assetCategoryId: schema.purchaseRequestItems.assetCategoryId,
        requesterId: schema.purchaseRequests.requesterId,
      })
      .from(schema.purchaseReceiptUnits)
      .innerJoin(
        schema.purchaseReceiptItems,
        eq(
          schema.purchaseReceiptUnits.purchaseReceiptItemId,
          schema.purchaseReceiptItems.id,
        ),
      )
      .innerJoin(
        schema.purchaseReceipts,
        eq(
          schema.purchaseReceiptItems.purchaseReceiptId,
          schema.purchaseReceipts.id,
        ),
      )
      .innerJoin(
        schema.purchaseOrderItems,
        eq(
          schema.purchaseReceiptItems.purchaseOrderItemId,
          schema.purchaseOrderItems.id,
        ),
      )
      .innerJoin(
        schema.purchaseRequestItems,
        eq(
          schema.purchaseOrderItems.purchaseRequestItemId,
          schema.purchaseRequestItems.id,
        ),
      )
      .innerJoin(
        schema.purchaseOrders,
        eq(schema.purchaseOrderItems.purchaseOrderId, schema.purchaseOrders.id),
      )
      .innerJoin(
        schema.purchaseRequestRevisions,
        eq(
          schema.purchaseOrders.requestRevisionId,
          schema.purchaseRequestRevisions.id,
        ),
      )
      .innerJoin(
        schema.purchaseRequests,
        eq(schema.purchaseOrders.purchaseRequestId, schema.purchaseRequests.id),
      )
      .where(eq(schema.purchaseReceiptUnits.id, unitId));

    if (!context) throw new NotFoundException('Không tìm thấy đơn vị kiểm tra.');

    return context;
  }

  private async refreshReceiptItem(
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
      .select({ deliveredQuantity: schema.purchaseReceiptItems.deliveredQuantity })
      .from(schema.purchaseReceiptItems)
      .where(eq(schema.purchaseReceiptItems.id, receiptItemId));

    await db
      .update(schema.purchaseReceiptItems)
      .set({
        acceptedQuantity: counts.accepted,
        rejectedQuantity: counts.rejected,
        inspectionResult:
          inspected === 0
            ? 'pending'
            : inspected === item.deliveredQuantity
              ? counts.rejected === 0
                ? 'accepted'
                : 'rejected'
              : 'pending',
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(schema.purchaseReceiptItems.id, receiptItemId));
  }

  private async refreshReceipt(
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

  private async refreshOrder(
    db: Database,
    orderId: string,
    actorId: string,
  ) {
    const items = await this.loadOrderItems(db, orderId);
    const progress = await this.loadOrderProgress(db, items);
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

  private allowedReceiptActions(actor: AuthenticatedEmployee) {
    const actions = getAllowedWorkflowActions(
      actor.roleName,
      actor.isDepartmentHead,
      actor.departmentName,
    );

    return actions.filter((action) => action.startsWith('purchase.receipt.'));
  }

  private inspectionOwner(actor: AuthenticatedEmployee): ManagementOwner {
    const action =
      actor.departmentName === 'IT'
        ? WORKFLOW_ACTIONS.purchaseReceiptInspectIt
        : WORKFLOW_ACTIONS.purchaseReceiptInspectProcurement;

    this.authorization.assertAction(actor, action);

    if (actor.departmentName === 'IT') return 'it';

    if (actor.departmentName === 'PROCUREMENT') return 'procurement';

    throw new ForbiddenException('Không thuộc bộ phận kiểm tra tài sản.');
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

  private lockOrder(db: Database, orderId: string) {
    return db.execute(
      sql`select id from purchase_orders where id = ${orderId} for update`,
    );
  }

  private createReceiptCode() {
    return `RCV-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private createAssetCode(assetId: string) {
    return `AST-${new Date().getFullYear()}-${assetId.slice(0, 8).toUpperCase()}`;
  }

  private async removeFiles(files: ReceiptFiles) {
    const paths = Object.values(files)
      .flatMap((entries) => entries ?? [])
      .map((file) => file.path);

    await Promise.all(paths.map((path) => unlink(path).catch(() => undefined)));
  }
}
