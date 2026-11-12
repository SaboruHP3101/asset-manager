import { BadRequestException, ConflictException } from '@nestjs/common';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { SavePurchaseOrderDto } from './dto/purchase-order.dto.js';
import {
  calculateOrderLineTotals,
  RESERVED_ORDER_STATUSES,
} from './purchase-order-calculations.js';
import { requireRequest } from './purchase-order-queries.js';

type Database = NodePgDatabase<typeof schema>;
export async function loadOrderInput(
  db: Database,
  dto: SavePurchaseOrderDto,
  excludedOrderId?: string,
) {
  // Lấy đề nghị mua đang ở trạng thái "đã duyệt" hoặc "vẫn còn số lượng chưa đặt hết"
  const request = await requireRequest(db, dto.purchaseRequestId, [
    'approved',
    'ordering',
  ]);
  // Lấy phiên bản mới nhất của đề nghị mua (đã được duyệt) đã query trước đó
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
    throw new ConflictException('Phiên bản được duyệt không tồn tại.');

  // Kiểm tra hợp đồng (nếu có) phải thuộc nhà cung cấp của đơn mua
  if (dto.contractId) {
    const [contract] = await db
      .select({ supplierId: schema.purchaseContracts.supplierId })
      .from(schema.purchaseContracts)
      .where(eq(schema.purchaseContracts.id, dto.contractId));

    if (!contract || contract.supplierId !== dto.supplierId) {
      throw new BadRequestException(
        'Hợp đồng không tồn tại hoặc không thuộc nhà cung cấp của đơn mua.',
      );
    }
  }

  const requestedIds = dto.items.map((item) => item.purchaseRequestItemId);

  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new BadRequestException('Mỗi hạng mục chỉ được xuất hiện một lần.');
  }

  const items = await db
    .select({
      id: schema.purchaseRequestItems.id,
      itemName: schema.purchaseRequestItems.itemName,
      approvedQuantity: schema.purchaseRequestItems.quantity,
      selectedQuoteId: schema.purchaseRequestQuotes.id,
      supplierId: schema.purchaseRequestQuotes.supplierId,
      unitPriceExclVat: schema.purchaseRequestQuotes.unitPriceExclVat,
      vatRate: schema.purchaseRequestQuotes.vatRate,
    })
    .from(schema.purchaseRequestItems)
    .innerJoin(
      schema.purchaseRequestQuotes,
      and(
        eq(
          schema.purchaseRequestQuotes.requestItemId,
          schema.purchaseRequestItems.id,
        ),
        eq(schema.purchaseRequestQuotes.isSelected, true),
      ),
    )
    .where(
      and(
        eq(schema.purchaseRequestItems.requestRevisionId, revision.id),
        inArray(schema.purchaseRequestItems.id, requestedIds),
      ),
    );

  if (items.length !== requestedIds.length) {
    throw new BadRequestException(
      'Có hạng mục không thuộc revision hiện tại hoặc chưa chọn báo giá.',
    );
  }

  if (items.some((item) => item.supplierId !== dto.supplierId)) {
    throw new BadRequestException(
      'Một PO chỉ gồm các hạng mục đã chọn cùng nhà cung cấp.',
    );
  }

  // Tính số lượng đã được giữ chỗ trên các đơn mua hiện có cho từng hạng mục đề nghị mua.
  const reservations = await db
    .select({
      itemId: schema.purchaseOrderItems.purchaseRequestItemId,
      quantity: sql<number>`coalesce(sum(${schema.purchaseOrderItems.quantity}), 0)::int`, // coalesce tránh nhận NULL nếu phép tổng không có giá trị. ::int ép kết quả trả về thành integer để DB driver trả về số thay vì chuỗi
    })
    .from(schema.purchaseOrderItems)
    .innerJoin(
      schema.purchaseOrders,
      eq(schema.purchaseOrderItems.purchaseOrderId, schema.purchaseOrders.id),
    )
    .where(
      and(
        inArray(schema.purchaseOrderItems.purchaseRequestItemId, requestedIds),
        inArray(schema.purchaseOrders.status, RESERVED_ORDER_STATUSES),
        ...(excludedOrderId
          ? [ne(schema.purchaseOrders.id, excludedOrderId)]
          : []),
      ),
    )
    .groupBy(schema.purchaseOrderItems.purchaseRequestItemId);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const reserved = new Map(
    reservations.map((row) => [row.itemId, row.quantity]),
  );

  // Kiểm tra số lượng yêu cầu không được vượt số lượng còn có thể đặt
  for (const input of dto.items) {
    const item = itemById.get(input.purchaseRequestItemId)!;
    const remaining = item.approvedQuantity - (reserved.get(item.id) ?? 0);

    if (input.quantity > remaining) {
      throw new ConflictException(
        `Hạng mục ${item.itemName} chỉ còn có thể đặt ${remaining}.`,
      );
    }
  }

  return { request, revision, items };
}

export async function insertOrderItems(
  db: Database,
  orderId: string,
  dto: SavePurchaseOrderDto,
  items: Awaited<ReturnType<typeof loadOrderInput>>['items'],
  actorId: string,
) {
  const itemById = new Map(items.map((item) => [item.id, item]));

  await db.insert(schema.purchaseOrderItems).values(
    dto.items.map((input) => {
      const item = itemById.get(input.purchaseRequestItemId)!;
      const totals = calculateOrderLineTotals(
        input.quantity,
        item.unitPriceExclVat,
        item.vatRate,
      );

      return {
        purchaseOrderId: orderId,
        purchaseRequestItemId: item.id,
        selectedQuoteId: item.selectedQuoteId,
        itemNameSnapshot: item.itemName,
        quantity: input.quantity,
        unitPriceExclVat: item.unitPriceExclVat,
        vatRate: item.vatRate,
        ...totals,
        createdBy: actorId,
        updatedBy: actorId,
      };
    }),
  );
}

export function validateDates(dto: SavePurchaseOrderDto): void {
  if (dto.expectedDeliveryDate < dto.orderDate) {
    throw new BadRequestException(
      'Ngày giao dự kiến không được trước ngày đặt hàng.',
    );
  }
}
