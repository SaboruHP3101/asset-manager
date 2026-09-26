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
import { CreateAssetLiquidationDto } from './dto/create-asset-liquidation.dto.js';
import { UpdateAssetLiquidationDto } from './dto/update-asset-liquidation.dto.js';
import { AssetLiquidation } from './entities/asset-liquidation.entity.js';

@Injectable()
export class AssetLiquidationsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createAssetLiquidationDto: CreateAssetLiquidationDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.assetLiquidations)
        .values(createAssetLiquidationDto)
        .returning();

      return new AssetLiquidation(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu đề nghị thanh lý tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể tạo đề nghị thanh lý tài sản',
      );
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.assetLiquidations);

    return records.map((record) => new AssetLiquidation(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.assetLiquidations)
      .where(eq(schema.assetLiquidations.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy đề nghị thanh lý tài sản có ID ${id}`,
      );
    }

    return new AssetLiquidation(record);
  }

  async update(
    id: string,
    updateAssetLiquidationDto: UpdateAssetLiquidationDto,
  ) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.assetLiquidations)
        .set({
          ...updateAssetLiquidationDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.assetLiquidations.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy đề nghị thanh lý tài sản có ID ${id}`,
        );
      }

      return new AssetLiquidation(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu đề nghị thanh lý tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể cập nhật đề nghị thanh lý tài sản',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.assetLiquidations)
        .where(eq(schema.assetLiquidations.id, id))
        .returning({ deletedId: schema.assetLiquidations.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy đề nghị thanh lý tài sản có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa đề nghị thanh lý tài sản vì dữ liệu đang được tham chiếu',
        );
      }

      throw new InternalServerErrorException(
        'Không thể xóa đề nghị thanh lý tài sản',
      );
    }
  }
}
