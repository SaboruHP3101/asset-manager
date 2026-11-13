import { isConstraintViolation } from '../db/query-errors.js';
import {
  ConflictException,
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, DrizzleQueryError, eq, inArray, isNull } from 'drizzle-orm';
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
      if (isConstraintViolation(error)) {
        throw new ConflictException(
          'Mã danh mục tài sản đã tồn tại. Vui lòng chọn mã khác.',
        );
      }

      throw new InternalServerErrorException('Không thể tạo danh mục tài sản', {
        cause: error,
      });
    }
  }

  async findAll() {
    const assetCategories = await this.db.select().from(schema.assetCategories);

    return assetCategories.map(
      (assetCategory) => new AssetCategory(assetCategory),
    );
  }

  async findPurchaseOptions() {
    const categories = await this.db
      .select()
      .from(schema.assetCategories)
      .where(eq(schema.assetCategories.isPurchaseOption, true))
      .orderBy(asc(schema.assetCategories.name));

    return categories.map((category) => new AssetCategory(category));
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
    await this.requireRoot(id);

    try {
      const [updatedAssetCategory] = await this.db
        .update(schema.assetCategories)
        .set({
          code: updateAssetCategoryDto.code,
          name: updateAssetCategoryDto.name,
          description: updateAssetCategoryDto.description,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.assetCategories.id, id),
            isNull(schema.assetCategories.parentCategoryId),
          ),
        )
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

      if (isConstraintViolation(error)) {
        throw new ConflictException(
          'Mã danh mục tài sản đã tồn tại. Vui lòng chọn mã khác.',
        );
      }

      throw new InternalServerErrorException(
        'Không thể cập nhật danh mục tài sản',
        { cause: error },
      );
    }
  }

  async remove(id: string, force = false) {
    await this.requireRoot(id);

    if (!force) {
      const children = await this.db
        .select({
          id: schema.assetCategories.id,
          code: schema.assetCategories.code,
          name: schema.assetCategories.name,
        })
        .from(schema.assetCategories)
        .where(eq(schema.assetCategories.parentCategoryId, id));

      if (children.length > 0) {
        throw new ConflictException({
          message:
            'Danh mục đang có danh mục con. Chọn xóa cả cha và con để tiếp tục.',
          children,
        });
      }
    }

    let deletedAssetCategories: { deletedId: string }[];

    try {
      if (force) {
        deletedAssetCategories = await this.db.transaction(async (tx) => {
          const categories = await tx
            .select({
              id: schema.assetCategories.id,
              parentCategoryId: schema.assetCategories.parentCategoryId,
            })
            .from(schema.assetCategories);
          const ids = new Set([id]);

          const pending = [id];

          while (pending.length) {
            const parentId = pending.pop()!;

            for (const category of categories) {
              if (
                category.parentCategoryId !== parentId ||
                ids.has(category.id)
              )
                continue;

              ids.add(category.id);
              pending.push(category.id);
            }
          }

          return tx
            .delete(schema.assetCategories)
            .where(inArray(schema.assetCategories.id, [...ids]))
            .returning({ deletedId: schema.assetCategories.id });
        });
      } else {
        deletedAssetCategories = await this.db
          .delete(schema.assetCategories)
          .where(
            and(
              eq(schema.assetCategories.id, id),
              isNull(schema.assetCategories.parentCategoryId),
            ),
          )
          .returning({ deletedId: schema.assetCategories.id });
      }
    } catch (error: unknown) {
      if (
        error instanceof DrizzleQueryError &&
        error.cause &&
        'code' in error.cause &&
        error.cause.code === '23503'
      ) {
        throw new ConflictException(
          'Không thể xóa vì danh mục có danh mục con hoặc đang được dữ liệu khác tham chiếu.',
        );
      }

      throw new InternalServerErrorException(
        'Không thể xóa danh mục tài sản. Vui lòng thử lại.',
        { cause: error },
      );
    }

    if (deletedAssetCategories.length === 0) {
      throw new NotFoundException(
        `Không tìm thấy danh mục tài sản có ID ${id}`,
      );
    }

    return { deleted: true };
  }

  private async requireRoot(id: string) {
    const category = await this.findOne(id);

    if (category.parentCategoryId !== null) {
      throw new BadRequestException(
        'Chỉ được quản lý danh mục tài sản cấp gốc.',
      );
    }
  }
}
