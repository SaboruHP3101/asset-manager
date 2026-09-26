import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  desc,
  DrizzleQueryError,
  eq,
  ilike,
  inArray,
} from 'drizzle-orm';
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

  // Tìm, lọc và sắp xếp tài sản của một nhân viên
  async findMine(
    employeeId: string,
    search?: string,
    categoryId?: string,
    sort = 'name_asc',
  ) {
    const conditions = [eq(schema.assets.currentUserId, employeeId)];

    if (search?.trim()) {
      conditions.push(ilike(schema.assetCategories.name, `%${search.trim()}%`));
    }

    if (categoryId) {
      /**
       * Mobile gửi danh mục cha, trong khi tài sản thường nằm ở danh mục lá.
       * Mở rộng toàn bộ cây con để bộ lọc cha bao gồm đúng các tài sản bên dưới.
       */
      const categories = await this.db
        .select({
          id: schema.assetCategories.id,
          parentId: schema.assetCategories.parentCategoryId,
        })
        .from(schema.assetCategories);
      const categoryIds = new Set<string>([categoryId]);
      let foundChild = true;

      while (foundChild) {
        foundChild = false;

        for (const category of categories) {
          if (
            category.parentId &&
            categoryIds.has(category.parentId) &&
            !categoryIds.has(category.id)
          ) {
            categoryIds.add(category.id);
            foundChild = true;
          }
        }
      }

      conditions.push(inArray(schema.assets.assetCategoryId, [...categoryIds]));
    }

    const records = await this.db
      .select({
        id: schema.assets.id,
        assetCode: schema.assets.assetCode,
        qrCode: schema.assets.qrCode,
        name: schema.assetCategories.name,
        department: schema.departments.name,
        status: schema.assets.status,
      })
      .from(schema.assets)
      .innerJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .leftJoin(
        schema.departments,
        eq(schema.assets.currentManagingDepartmentId, schema.departments.id),
      )
      .where(and(...conditions))
      .orderBy(
        sort === 'name_desc'
          ? desc(schema.assetCategories.name)
          : asc(schema.assetCategories.name),
      );

    if (records.length === 0) return [];

    // Lấy ảnh đầu tiên của từng tài sản nếu có
    const attachments = await this.db
      .select()
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.entityType, 'asset'),
          inArray(
            schema.attachments.entityId,
            records.map((record) => record.id),
          ),
        ),
      )
      .orderBy(asc(schema.attachments.createdAt));

    const images = new Map<string, string>();

    for (const attachment of attachments) {
      if (!images.has(attachment.entityId)) {
        images.set(attachment.entityId, attachment.url);
      }
    }

    return records.map((record) => ({
      ...record,
      imageUrl: images.get(record.id) ?? null,
    }));
  }

  /**
   * Chỉ trả danh mục gốc có tài sản của nhân viên ở một nhánh con. API riêng này
   * giúp mobile không hiển thị lựa chọn filter chắc chắn cho kết quả rỗng.
   */
  async findMyParentCategories(employeeId: string) {
    const [categories, ownedCategories] = await Promise.all([
      this.db
        .select({
          id: schema.assetCategories.id,
          name: schema.assetCategories.name,
          parentId: schema.assetCategories.parentCategoryId,
        })
        .from(schema.assetCategories),
      this.db
        .selectDistinct({ categoryId: schema.assets.assetCategoryId })
        .from(schema.assets)
        .where(eq(schema.assets.currentUserId, employeeId)),
    ]);

    const categoryById = new Map(categories.map((item) => [item.id, item]));
    const rootIds = new Set<string>();

    for (const owned of ownedCategories) {
      let current = categoryById.get(owned.categoryId);

      while (current?.parentId) {
        current = categoryById.get(current.parentId);
      }

      if (current) rootIds.add(current.id);
    }

    return categories
      .filter((category) => rootIds.has(category.id))
      .map(({ id, name }) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'));
  }

  // Lấy đầy đủ thông tin tài sản để hiển thị trang chi tiết
  async findMineById(employeeId: string, assetId: string) {
    const [record] = await this.db
      .select({
        id: schema.assets.id,
        assetCode: schema.assets.assetCode,
        qrCode: schema.assets.qrCode,
        name: schema.assetCategories.name,
        category: schema.assetCategories.name,
        department: schema.departments.name,
        supplier: schema.suppliers.legalName,
        status: schema.assets.status,
        purchaseDate: schema.assets.purchaseDate,
        inServiceDate: schema.assets.inServiceDate,
        initialValue: schema.assets.initialValue,
      })
      .from(schema.assets)
      .innerJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .innerJoin(
        schema.suppliers,
        eq(schema.assets.supplierId, schema.suppliers.id),
      )
      .leftJoin(
        schema.departments,
        eq(schema.assets.currentManagingDepartmentId, schema.departments.id),
      )
      .where(
        and(
          eq(schema.assets.id, assetId),
          eq(schema.assets.currentUserId, employeeId),
        ),
      );

    if (!record) {
      throw new NotFoundException('Không tìm thấy tài sản được quản lý.');
    }

    const [attachment] = await this.db
      .select({ url: schema.attachments.url })
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.entityType, 'asset'),
          eq(schema.attachments.entityId, assetId),
        ),
      )
      .orderBy(asc(schema.attachments.createdAt));

    return { ...record, imageUrl: attachment?.url ?? null };
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
