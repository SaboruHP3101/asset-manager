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
import { CreatePurchaseOrderItemDto } from './dto/create-purchase-order-item.dto.js';
import { UpdatePurchaseOrderItemDto } from './dto/update-purchase-order-item.dto.js';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity.js';

@Injectable()
export class PurchaseOrderItemsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createPurchaseOrderItemDto: CreatePurchaseOrderItemDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.purchaseOrderItems)
        .values(createPurchaseOrderItemDto)
        .returning();

      return new PurchaseOrderItem(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu hạng mục đơn đặt hàng đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể tạo hạng mục đơn đặt hàng',
      );
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.purchaseOrderItems);

    return records.map((record) => new PurchaseOrderItem(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy hạng mục đơn đặt hàng có ID ${id}`,
      );
    }

    return new PurchaseOrderItem(record);
  }

  async update(
    id: string,
    updatePurchaseOrderItemDto: UpdatePurchaseOrderItemDto,
  ) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.purchaseOrderItems)
        .set({
          ...updatePurchaseOrderItemDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseOrderItems.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy hạng mục đơn đặt hàng có ID ${id}`,
        );
      }

      return new PurchaseOrderItem(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu hạng mục đơn đặt hàng đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật hạng mục đơn đặt hàng',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.purchaseOrderItems)
        .where(eq(schema.purchaseOrderItems.id, id))
        .returning({ deletedId: schema.purchaseOrderItems.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy hạng mục đơn đặt hàng có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa hạng mục đơn đặt hàng vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException(
        'Không thể xóa hạng mục đơn đặt hàng',
      );
    }
  }
}
