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
import { CreateAssetInventoryDto } from './dto/create-asset-inventory.dto.js';
import { UpdateAssetInventoryDto } from './dto/update-asset-inventory.dto.js';
import { AssetInventory } from './entities/asset-inventory.entity.js';

@Injectable()
export class AssetInventoriesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createAssetInventoryDto: CreateAssetInventoryDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.assetInventories)
        .values(createAssetInventoryDto)
        .returning();

      return new AssetInventory(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu kiểm kê tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo kiểm kê tài sản');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.assetInventories);

    return records.map((record) => new AssetInventory(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.assetInventories)
      .where(eq(schema.assetInventories.id, id));

    if (!record) {
      throw new NotFoundException(`Không tìm thấy kiểm kê tài sản có ID ${id}`);
    }

    return new AssetInventory(record);
  }

  async update(id: string, updateAssetInventoryDto: UpdateAssetInventoryDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.assetInventories)
        .set({
          ...updateAssetInventoryDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.assetInventories.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(
          `Không tìm thấy kiểm kê tài sản có ID ${id}`,
        );
      }

      return new AssetInventory(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu kiểm kê tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể cập nhật kiểm kê tài sản',
      );
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.assetInventories)
        .where(eq(schema.assetInventories.id, id))
        .returning({ deletedId: schema.assetInventories.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(
          `Không tìm thấy kiểm kê tài sản có ID ${id}`,
        );
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa kiểm kê tài sản vì dữ liệu đang được tham chiếu',
        );
      }

      throw new InternalServerErrorException('Không thể xóa kiểm kê tài sản');
    }
  }
}
