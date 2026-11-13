import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { isConstraintViolation } from '../db/query-errors.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import {
  findHandoverHistory,
  findMine,
  findMineById,
  findMyParentCategories,
} from './asset-personal-queries.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { Asset } from './entities/asset.entity.js';

const editableFields = [
  'assetCode',
  'name',
  'assetCategoryId',
  'supplierId',
  'initialValue',
  'purchaseDate',
  'inServiceDate',
] as const satisfies readonly (keyof UpdateAssetDto)[];

const insignificantDecimalZeros = /(?:\.0+|(\.\d*?[1-9])0+)$/;

@Injectable()
export class AssetsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}
  findMine(
    employeeId: string,
    search?: string,
    categoryId?: string,
    sort = 'name_asc',
  ) {
    return findMine(this.db, employeeId, search, categoryId, sort);
  }

  findMyParentCategories(employeeId: string) {
    return findMyParentCategories(this.db, employeeId);
  }

  findMineById(employeeId: string, assetId: string) {
    return findMineById(this.db, employeeId, assetId);
  }
  async create(createAssetDto: CreateAssetDto) {
    try {
      const [newRecord] = await this.db
        .insert(schema.assets)
        .values(createAssetDto)
        .returning();

      return new Asset(newRecord);
    } catch (error: unknown) {
      if (isConstraintViolation(error)) {
        throw new ConflictException(
          'Dữ liệu tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể tạo tài sản', {
        cause: error,
      });
    }
  }

  async findAll() {
    const records = await this.db
      .select({
        ...getTableColumns(schema.assets),
        name: sql<string>`coalesce(${schema.assets.name}, ${schema.assetCategories.name})`,
        category: schema.assetCategories.name,
        assignedTo: schema.employees.fullName,
        department: schema.departments.name,
        purchaseOrderId: schema.purchaseOrderItems.purchaseOrderId,
        purchaseOrderOwner: schema.purchaseRequestItems.managementOwnerSnapshot,
        location: sql<
          string | null
        >`coalesce(${schema.warehouses.name}, ${schema.assets.currentLocation})`,
      })
      .from(schema.assets)
      .leftJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .leftJoin(
        schema.employees,
        eq(schema.assets.currentUserId, schema.employees.id),
      )
      .leftJoin(
        schema.departments,
        eq(schema.assets.currentManagingDepartmentId, schema.departments.id),
      )
      .leftJoin(
        schema.warehouses,
        eq(schema.assets.currentWarehouseId, schema.warehouses.id),
      )
      .leftJoin(
        schema.purchaseOrderItems,
        eq(schema.assets.purchaseOrderItemId, schema.purchaseOrderItems.id),
      )
      .leftJoin(
        schema.purchaseRequestItems,
        eq(
          schema.purchaseOrderItems.purchaseRequestItemId,
          schema.purchaseRequestItems.id,
        ),
      );

    return records.map((record) => new Asset(record));
  }

  async findHistory(assetId: string) {
    const history = schema.changeHistory;
    const [changes, handovers] = await Promise.all([
      this.db
        .select({
          id: history.id,
          oldData: history.oldData,
          newData: history.newData,
          createdAt: history.createdAt,
          employeeName: schema.employees.fullName,
        })
        .from(history)
        .innerJoin(
          schema.employees,
          eq(history.performedByEmployeeId, schema.employees.id),
        )
        .where(
          and(
            eq(history.entityType, 'asset'),
            eq(history.entityId, assetId),
            eq(history.action, 'update'),
          ),
        )
        .orderBy(desc(history.createdAt), desc(history.id)),
      findHandoverHistory(this.db, assetId),
    ]);

    return { changes, handovers };
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

  async update(id: string, updateAssetDto: UpdateAssetDto, employeeId: string) {
    try {
      return await this.db.transaction(async (tx) => {
        // Read the previous values under the same lock as the update.
        const [previous] = await tx
          .select()
          .from(schema.assets)
          .where(eq(schema.assets.id, id))
          .for('update');

        if (!previous) {
          throw new NotFoundException(`Không tìm thấy tài sản có ID ${id}`);
        }

        const [updated] = await tx
          .update(schema.assets)
          .set({ ...updateAssetDto, updatedAt: new Date() })
          .where(eq(schema.assets.id, id))
          .returning();
        const oldData: Partial<
          Record<(typeof editableFields)[number], string | null>
        > = {};
        const newData: typeof oldData = {};

        for (const field of editableFields) {
          const before = previous[field];
          const after = updated[field];

          if (before === after) continue;

          if (
            field === 'initialValue' &&
            previous.initialValue.replace(insignificantDecimalZeros, '$1') ===
              updated.initialValue.replace(insignificantDecimalZeros, '$1')
          ) {
            continue;
          }

          oldData[field] = before;
          newData[field] = after;
        }

        if (Object.keys(newData).length > 0) {
          await tx.insert(schema.changeHistory).values({
            entityType: 'asset',
            entityId: id,
            action: 'update',
            oldData,
            newData,
            performedByEmployeeId: employeeId,
          });
        }

        return new Asset(updated);
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (isConstraintViolation(error)) {
        throw new ConflictException(
          'Dữ liệu tài sản đã tồn tại hoặc chứa tham chiếu không hợp lệ',
        );
      }

      throw new InternalServerErrorException('Không thể cập nhật tài sản', {
        cause: error,
      });
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

      if (isConstraintViolation(error)) {
        throw new ConflictException(
          'Không thể xóa tài sản vì dữ liệu đang được tham chiếu',
        );
      }

      throw new InternalServerErrorException('Không thể xóa tài sản', {
        cause: error,
      });
    }
  }
}
