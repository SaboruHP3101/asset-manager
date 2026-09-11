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
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { Asset } from './entities/asset.entity.js';

@Injectable()
export class AssetsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createAssetDto: CreateAssetDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.assets)
        .values(createAssetDto)
        .returning();

      return new Asset(newRecord);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo tài sản');
    }
  }

  async findAll() {
    const records = await this.db.select().from(schema.assets);

    return records.map((record) => new Asset(record));
  }

  async findOne(id: string) {
    const [record] = await this.db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.id, id));

    if (!record) {
      throw new NotFoundException(`Không tìm thấy tài sản có ID ${id}`);
    }

    return new Asset(record);
  }

  async update(id: string, updateAssetDto: UpdateAssetDto) {
    try {
      const [updatedRecord] = await this.db
        .update(schema.assets)
        .set({
          ...updateAssetDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.assets.id, id))
        .returning();

      if (!updatedRecord) {
        throw new NotFoundException(`Không tìm thấy tài sản có ID ${id}`);
      }

      return new Asset(updatedRecord);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Dữ liệu tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }
      throw new InternalServerErrorException('Không thể cập nhật tài sản');
    }
  }

  async remove(id: string) {
    try {
      const deletedRecords = await this.db
        .delete(schema.assets)
        .where(eq(schema.assets.id, id))
        .returning({ deletedId: schema.assets.id });

      if (deletedRecords.length === 0) {
        throw new NotFoundException(`Không tìm thấy tài sản có ID ${id}`);
      }

      return { deleted: true };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Không thể xóa tài sản vì dữ liệu đang được tham chiếu',
        );
      }
      throw new InternalServerErrorException('Không thể xóa tài sản');
    }
  }
}
