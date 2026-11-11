import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';

const {
  assets,
  departments,
  purchaseOrders,
  purchaseOrderItems,
  purchaseReceiptItems,
  purchaseRequests,
  purchaseRequestItems,
  suppliers,
} = schema;

@Injectable()
export class ItPurchaseOrdersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private resolveOwner(actor: AuthenticatedEmployee, owner?: string) {
    if (
      actor.departmentName !== 'IT' &&
      actor.departmentName !== 'PROCUREMENT'
    ) {
      throw new ForbiddenException(
        'Chỉ IT và Thu mua được xem đơn mua tài sản.',
      );
    }

    if (owner === undefined) {
      return actor.departmentName === 'IT' ? 'it' : 'procurement';
    }

    if (owner !== 'it' && owner !== 'procurement') {
      throw new BadRequestException('Đơn vị quản lý không hợp lệ.');
    }

    return owner;
  }

  async findAll(actor: AuthenticatedEmployee, owner?: string) {
    return this.findOrders(this.resolveOwner(actor, owner));
  }

  private findOrders(
    owner: (typeof schema.assetManagementOwnerEnum.enumValues)[number],
    id?: string,
  ) {
    return this.db
      .select({
        id: purchaseOrders.id,
        code: purchaseOrders.purchaseOrderCode,
        supplierId: suppliers.id,
        supplierName: suppliers.legalName,
        department: departments.name,
        status: purchaseOrders.status,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        total: sql<string>`sum(${purchaseOrderItems.totalInclVat})::text`,
      })
      .from(purchaseOrders)
      .innerJoin(
        purchaseOrderItems,
        eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id),
      )
      .innerJoin(
        purchaseRequestItems,
        eq(purchaseRequestItems.id, purchaseOrderItems.purchaseRequestItemId),
      )
      .innerJoin(
        purchaseRequests,
        eq(purchaseRequests.id, purchaseOrders.purchaseRequestId),
      )
      .innerJoin(departments, eq(departments.id, purchaseRequests.departmentId))
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(
        and(
          eq(purchaseRequestItems.managementOwnerSnapshot, owner),
          inArray(purchaseOrders.status, [
            'issued',
            'partially_received',
            'fully_received',
            'closed_short',
            'cancelled',
          ]),
          id === undefined ? undefined : eq(purchaseOrders.id, id),
        ),
      )
      .groupBy(purchaseOrders.id, suppliers.id, departments.id)
      .orderBy(
        desc(purchaseOrders.orderDate),
        asc(purchaseOrders.purchaseOrderCode),
      );
  }

  async findOne(
    actor: AuthenticatedEmployee,
    id: string,
    requestedOwner?: string,
  ) {
    const owner = this.resolveOwner(actor, requestedOwner);
    const [order] = await this.findOrders(owner, id);

    if (!order)
      throw new NotFoundException(
        'Không tìm thấy đơn mua cho đơn vị quản lý đã chọn.',
      );

    const lines = await this.db
      .select({
        id: purchaseOrderItems.id,
        name: purchaseOrderItems.itemNameSnapshot,
        ordered: purchaseOrderItems.quantity,
        received: sql<number>`coalesce(sum(${purchaseReceiptItems.deliveredQuantity}), 0)::int`,
        accepted: sql<number>`coalesce(sum(${purchaseReceiptItems.acceptedQuantity}), 0)::int`,
        rejected: sql<number>`coalesce(sum(${purchaseReceiptItems.rejectedQuantity}), 0)::int`,
        total: purchaseOrderItems.totalInclVat,
      })
      .from(purchaseOrderItems)
      .innerJoin(
        purchaseRequestItems,
        eq(purchaseRequestItems.id, purchaseOrderItems.purchaseRequestItemId),
      )
      .leftJoin(
        purchaseReceiptItems,
        eq(purchaseReceiptItems.purchaseOrderItemId, purchaseOrderItems.id),
      )
      .where(
        and(
          eq(purchaseOrderItems.purchaseOrderId, id),
          eq(purchaseRequestItems.managementOwnerSnapshot, owner),
        ),
      )
      .groupBy(purchaseOrderItems.id)
      .orderBy(
        asc(purchaseOrderItems.itemNameSnapshot),
        asc(purchaseOrderItems.id),
      );

    const assetRows =
      lines.length === 0
        ? []
        : await this.db
            .select({
              lineId: assets.purchaseOrderItemId,
              code: assets.assetCode,
            })
            .from(assets)
            .where(
              inArray(
                assets.purchaseOrderItemId,
                lines.map((line) => line.id),
              ),
            )
            .orderBy(asc(assets.assetCode));
    const codes = new Map<string | null, string[]>();

    for (const asset of assetRows) {
      const lineCodes = codes.get(asset.lineId) ?? [];

      lineCodes.push(asset.code);
      codes.set(asset.lineId, lineCodes);
    }

    return {
      ...order,
      lines: lines.map((line) => ({
        ...line,
        assetCodes: codes.get(line.id) ?? [],
      })),
    };
  }
}
