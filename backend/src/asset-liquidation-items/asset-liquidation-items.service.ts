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
import { CreateAssetLiquidationItemDto } from './dto/create-asset-liquidation-item.dto.js';
import { UpdateAssetLiquidationItemDto } from './dto/update-asset-liquidation-item.dto.js';
import { AssetLiquidationItem } from './entities/asset-liquidation-item.entity.js';

@Injectable()
export class AssetLiquidationItemsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createAssetLiquidationItemDto: CreateAssetLiquidationItemDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.assetLiquidationItems)
        .values(createAssetLiquidationItemDto)
        .returning();

      return new AssetLiquidationItem(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu hạng mục thanh lý tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể tạo hạng mục thanh lý tài sản',
      );
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.assetLiquidationItems);

    return records.map((record) => new AssetLiquidationItem(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.assetLiquidationItems)
      .where(eq(schema.assetLiquidationItems.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy hạng mục thanh lý tài sản có ID ${id}`,
      );
    }

    return new AssetLiquidationItem(record);
  }

  async update(
    id: string,
    updateAssetLiquidationItemDto: UpdateAssetLiquidationItemDto,
  ) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.assetLiquidationItems)
        .set({
          ...updateAssetLiquidationItemDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.assetLiquidationItems.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy hạng mục thanh lý tài sản có ID ${id}`,
        );
      }

      return new AssetLiquidationItem(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu hạng mục thanh lý tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể cập nhật hạng mục thanh lý tài sản',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.assetLiquidationItems)
        .where(eq(schema.assetLiquidationItems.id, id))
        .returning({ deletedId: schema.assetLiquidationItems.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy hạng mục thanh lý tài sản có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa hạng mục thanh lý tài sản vì dữ liệu đang được tham chiếu',
        );
      }

      throw new InternalServerErrorException(
        'Không thể xóa hạng mục thanh lý tài sản',
      );
    }
  }
}
