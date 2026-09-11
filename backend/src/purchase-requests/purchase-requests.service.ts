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
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto.js';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto.js';
import { PurchaseRequest } from './entities/purchase-request.entity.js';

@Injectable()
export class PurchaseRequestsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createPurchaseRequestDto: CreatePurchaseRequestDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.purchaseRequests)
        .values(createPurchaseRequestDto)
        .returning();

      return new PurchaseRequest(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu yêu cầu mua sắm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo yêu cầu mua sắm');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.purchaseRequests);

    return records.map((record) => new PurchaseRequest(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.id, id));

    if (!record) {
      throw new NotFoundException(`Không tìm thấy yêu cầu mua sắm có ID ${id}`);
    }

    return new PurchaseRequest(record);
  }

  async update(id: string, updatePurchaseRequestDto: UpdatePurchaseRequestDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.purchaseRequests)
        .set({
          ...updatePurchaseRequestDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseRequests.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy yêu cầu mua sắm có ID ${id}`,
        );
      }

      return new PurchaseRequest(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu yêu cầu mua sắm đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật yêu cầu mua sắm',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.purchaseRequests)
        .where(eq(schema.purchaseRequests.id, id))
        .returning({ deletedId: schema.purchaseRequests.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy yêu cầu mua sắm có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa yêu cầu mua sắm vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa yêu cầu mua sắm');
    }
  }
}
