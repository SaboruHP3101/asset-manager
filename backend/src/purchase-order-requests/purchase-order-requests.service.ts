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
import { CreatePurchaseOrderRequestDto } from './dto/create-purchase-order-request.dto.js';
import { UpdatePurchaseOrderRequestDto } from './dto/update-purchase-order-request.dto.js';
import { PurchaseOrderRequest } from './entities/purchase-order-request.entity.js';

@Injectable()
export class PurchaseOrderRequestsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createPurchaseOrderRequestDto: CreatePurchaseOrderRequestDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.purchaseOrderRequests)
        .values(createPurchaseOrderRequestDto)
        .returning();

      return new PurchaseOrderRequest(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu liên kết đơn đặt hàng và yêu cầu mua sắm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể tạo liên kết đơn đặt hàng và yêu cầu mua sắm',
      );
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.purchaseOrderRequests);

    return records.map((record) => new PurchaseOrderRequest(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.purchaseOrderRequests)
      .where(eq(schema.purchaseOrderRequests.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy liên kết đơn đặt hàng và yêu cầu mua sắm có ID ${id}`,
      );
    }

    return new PurchaseOrderRequest(record);
  }

  async update(
    id: string,
    updatePurchaseOrderRequestDto: UpdatePurchaseOrderRequestDto,
  ) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.purchaseOrderRequests)
        .set({
          ...updatePurchaseOrderRequestDto,
        })
        .where(eq(schema.purchaseOrderRequests.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy liên kết đơn đặt hàng và yêu cầu mua sắm có ID ${id}`,
        );
      }

      return new PurchaseOrderRequest(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu liên kết đơn đặt hàng và yêu cầu mua sắm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật liên kết đơn đặt hàng và yêu cầu mua sắm',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.purchaseOrderRequests)
        .where(eq(schema.purchaseOrderRequests.id, id))
        .returning({ deletedId: schema.purchaseOrderRequests.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy liên kết đơn đặt hàng và yêu cầu mua sắm có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa liên kết đơn đặt hàng và yêu cầu mua sắm vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException(
        'Không thể xóa liên kết đơn đặt hàng và yêu cầu mua sắm',
      );
    }
  }
}
