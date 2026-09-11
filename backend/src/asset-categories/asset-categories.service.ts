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
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto.js';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto.js';
import { AssetCategory } from './entities/asset-category.entity.js';

@Injectable()
export class AssetCategoriesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createAssetCategoryDto: CreateAssetCategoryDto) {
    try {
      const [newAssetCategory] = await this.db
        .insert(schema.assetCategories)
        .values(createAssetCategoryDto)
        .returning();

      return new AssetCategory(newAssetCategory);
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Mã danh mục tài sản đã tồn tại hoặc danh mục cha không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo danh mục tài sản');
    }
  }

  async findAll() {
    const assetCategories = await this.db.select().from(schema.assetCategories);

    return assetCategories.map(
      (assetCategory) => new AssetCategory(assetCategory),
    );
  }

  async findOne(id: string) {
    const [assetCategory] = await this.db
      .select()
      .from(schema.assetCategories)
      .where(eq(schema.assetCategories.id, id));

    if (!assetCategory) {
      throw new NotFoundException(
        `Không tìm thấy danh mục tài sản có ID ${id}`,
      );
    }

    return new AssetCategory(assetCategory);
  }

  async update(id: string, updateAssetCategoryDto: UpdateAssetCategoryDto) {
    try {
      const [updatedAssetCategory] = await this.db
        .update(schema.assetCategories)
        .set({
          ...updateAssetCategoryDto,
          updatedAt: new Date(),
        })
        .where(eq(schema.assetCategories.id, id))
        .returning();

      if (!updatedAssetCategory) {
        throw new NotFoundException(
          `Không tìm thấy danh mục tài sản có ID ${id}`,
        );
      }

      return new AssetCategory(updatedAssetCategory);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof DrizzleQueryError) {
        throw new ConflictException(
          'Mã danh mục tài sản đã tồn tại hoặc danh mục cha không hợp lệ',
        );
      }

      throw new InternalServerErrorException(
        'Không thể cập nhật danh mục tài sản',
      );
    }
  }

  async remove(id: string) {
    const deletedAssetCategories = await this.db
      .delete(schema.assetCategories)
      .where(eq(schema.assetCategories.id, id))
      .returning({ deletedId: schema.assetCategories.id });

    if (deletedAssetCategories.length === 0) {
      throw new NotFoundException(
        `Không tìm thấy danh mục tài sản có ID ${id}`,
      );
    }

    return { deleted: true };
  }
}
