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
import { CreateAssetDepreciationDto } from './dto/create-asset-depreciation.dto.js';
import { UpdateAssetDepreciationDto } from './dto/update-asset-depreciation.dto.js';
import { AssetDepreciation } from './entities/asset-depreciation.entity.js';

@Injectable()
export class AssetDepreciationsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createAssetDepreciationDto: CreateAssetDepreciationDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.assetDepreciations)
        .values(createAssetDepreciationDto)
        .returning();

      return new AssetDepreciation(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu khấu hao tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo khấu hao tài sản');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.assetDepreciations);

    return records.map((record) => new AssetDepreciation(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.assetDepreciations)
      .where(eq(schema.assetDepreciations.id, id));

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy khấu hao tài sản có ID ${id}`,
      );
    }

    return new AssetDepreciation(record);
  }

  async update(
    id: string,
    updateAssetDepreciationDto: UpdateAssetDepreciationDto,
  ) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.assetDepreciations)
        .set({
          ...updateAssetDepreciationDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.assetDepreciations.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy khấu hao tài sản có ID ${id}`,
        );
      }

      return new AssetDepreciation(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu khấu hao tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException(
        'Không thể cập nhật khấu hao tài sản',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.assetDepreciations)
        .where(eq(schema.assetDepreciations.id, id))
        .returning({ deletedId: schema.assetDepreciations.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy khấu hao tài sản có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa khấu hao tài sản vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa khấu hao tài sản');
    }
  }
}
