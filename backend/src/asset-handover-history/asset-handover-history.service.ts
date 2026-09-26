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
import { CreateAssetHandoverHistoryDto } from './dto/create-asset-handover-history.dto.js';
import { UpdateAssetHandoverHistoryDto } from './dto/update-asset-handover-history.dto.js';
import { AssetHandoverHistory } from './entities/asset-handover-history.entity.js';

@Injectable()
export class AssetHandoverHistoryService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createAssetHandoverHistoryDto: CreateAssetHandoverHistoryDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.assetHandoverHistory)
        .values(createAssetHandoverHistoryDto)
        .returning();

      return new AssetHandoverHistory(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu lịch sử bàn giao tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể tạo lịch sử bàn giao tài sản',
      );
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.assetHandoverHistory);

    return records.map((record) => new AssetHandoverHistory(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.assetHandoverHistory)
      .where(eq(schema.assetHandoverHistory.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy lịch sử bàn giao tài sản có ID ${id}`,
      );
    }

    return new AssetHandoverHistory(record);
  }

  async update(
    id: string,
    updateAssetHandoverHistoryDto: UpdateAssetHandoverHistoryDto,
  ) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.assetHandoverHistory)
        .set({
          ...updateAssetHandoverHistoryDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.assetHandoverHistory.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy lịch sử bàn giao tài sản có ID ${id}`,
        );
      }

      return new AssetHandoverHistory(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu lịch sử bàn giao tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể cập nhật lịch sử bàn giao tài sản',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.assetHandoverHistory)
        .where(eq(schema.assetHandoverHistory.id, id))
        .returning({ deletedId: schema.assetHandoverHistory.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy lịch sử bàn giao tài sản có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa lịch sử bàn giao tài sản vì dữ liệu đang được tham chiếu',
        );
      }

      throw new InternalServerErrorException(
        'Không thể xóa lịch sử bàn giao tài sản',
      );
    }
  }
}
