import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleQueryError, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto.js';
import { PurchaseOrder } from './entities/purchase-order.entity.js';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.purchaseOrders)
        .values(createPurchaseOrderDto)
        .returning();

      return new PurchaseOrder(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu đơn đặt hàng đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo đơn đặt hàng');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.purchaseOrders);

    return records.map((record) => new PurchaseOrder(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.purchaseOrders)
      .where(eq(schema.purchaseOrders.id, id));

    if (!record) {
      throw new NotFoundException(`Không tìm thấy đơn đặt hàng có ID ${id}`);
    }

    return new PurchaseOrder(record);
  }

  async update(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.purchaseOrders)
        .set({
          ...updatePurchaseOrderDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseOrders.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(`Không tìm thấy đơn đặt hàng có ID ${id}`);
      }

      return new PurchaseOrder(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu đơn đặt hàng đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException('Không thể cập nhật đơn đặt hàng');
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.purchaseOrders)
        .where(eq(schema.purchaseOrders.id, id))
        .returning({ deletedId: schema.purchaseOrders.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(`Không tìm thấy đơn đặt hàng có ID ${id}`);
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa đơn đặt hàng vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa đơn đặt hàng');
    }
  }
}
