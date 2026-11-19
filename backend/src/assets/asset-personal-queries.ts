import { NotFoundException } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';

type Database = NodePgDatabase<typeof schema>;

export async function findMine(
  db: Database,
  employeeId: string,
  search?: string,
  categoryId?: string,
  sort = 'name_asc',
) {
  const conditions = [eq(schema.assets.currentUserId, employeeId)];
  const displayName = sql<string>`coalesce(${schema.assets.name}, ${schema.assetCategories.name})`;

  if (search?.trim()) {
    const keyword = `%${search.trim()}%`;

    conditions.push(
      or(
        ilike(schema.assets.name, keyword),
        ilike(schema.assetCategories.name, keyword),
        ilike(schema.assets.assetCode, keyword),
      )!,
    );
  }

  if (categoryId) {
    /**
     * Mobile gửi danh mục cha, trong khi tài sản thường nằm ở danh mục lá.
     * Mở rộng toàn bộ cây con để bộ lọc cha bao gồm đúng các tài sản bên dưới.
     */
    const categories = await db
      .select({
        id: schema.assetCategories.id,
        parentId: schema.assetCategories.parentCategoryId,
      })
      .from(schema.assetCategories);
    const categoryIds = new Set<string>([categoryId]);
    const childrenByParent = new Map<string, string[]>();

    for (const category of categories) {
      if (!category.parentId) continue;

      const children = childrenByParent.get(category.parentId) ?? [];

      children.push(category.id);
      childrenByParent.set(category.parentId, children);
    }

    const pending = [categoryId];

    while (pending.length) {
      const parentId = pending.pop()!;

      for (const childId of childrenByParent.get(parentId) ?? []) {
        if (categoryIds.has(childId)) continue;

        categoryIds.add(childId);
        pending.push(childId);
      }
    }

    conditions.push(inArray(schema.assets.assetCategoryId, [...categoryIds]));
  }

  const records = await db
    .select({
      id: schema.assets.id,
      assetCode: schema.assets.assetCode,
      qrCode: schema.assets.qrCode,
      name: displayName,
      category: schema.assetCategories.name,
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
    .orderBy(sort === 'name_desc' ? desc(displayName) : asc(displayName));

  if (records.length === 0) return [];

  // Lấy ảnh đầu tiên của từng tài sản nếu có
  const attachments = await db
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

export async function findMyParentCategories(db: Database, employeeId: string) {
  const [categories, ownedCategories] = await Promise.all([
    db
      .select({
        id: schema.assetCategories.id,
        name: schema.assetCategories.name,
        parentId: schema.assetCategories.parentCategoryId,
      })
      .from(schema.assetCategories),
    db
      .selectDistinct({ categoryId: schema.assets.assetCategoryId })
      .from(schema.assets)
      .where(eq(schema.assets.currentUserId, employeeId)),
  ]);

  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const rootIds = new Set<string>();

  for (const owned of ownedCategories) {
    let current = categoryById.get(owned.categoryId);
    const visited = new Set<string>();

    while (current?.parentId) {
      if (visited.has(current.id)) {
        current = undefined;
        break;
      }

      visited.add(current.id);
      current = categoryById.get(current.parentId);
    }

    if (current) rootIds.add(current.id);
  }

  return categories
    .filter((category) => rootIds.has(category.id))
    .map(({ id, name }) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'vi'));
}

export async function findMineById(
  db: Database,
  employeeId: string,
  assetId: string,
) {
  const [record] = await db
    .select({
      id: schema.assets.id,
      assetCode: schema.assets.assetCode,
      qrCode: schema.assets.qrCode,
      name: sql<string>`coalesce(${schema.assets.name}, ${schema.assetCategories.name})`,
      category: schema.assetCategories.name,
      department: schema.departments.name,
      supplier: schema.suppliers.legalName,
      status: schema.assets.status,
      currentLocation: schema.assets.currentLocation,
      assignedTo: schema.employees.fullName,
      purchaseDate: schema.assets.purchaseDate,
      inServiceDate: schema.assets.inServiceDate,
      initialValue: schema.assets.initialValue,
      currentValue: schema.assets.currentValue,
      managementOwner: schema.assetCategories.managementOwner,
      currentWarehouseId: schema.assets.currentWarehouseId,
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
    .leftJoin(
      schema.employees,
      eq(schema.assets.currentUserId, schema.employees.id),
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

  const [attachment] = await db
    .select({ url: schema.attachments.url })
    .from(schema.attachments)
    .where(
      and(
        eq(schema.attachments.entityType, 'asset'),
        eq(schema.attachments.entityId, assetId),
      ),
    )
    .orderBy(asc(schema.attachments.createdAt));

  const handoverHistory = await findHandoverHistory(db, assetId);
  const [activeRecall] = await db
    .select({
      id: schema.assetRecallRequests.id,
      status: schema.assetRecallRequests.status,
    })
    .from(schema.assetRecallRequests)
    .where(
      and(
        eq(schema.assetRecallRequests.assetId, assetId),
        notInArray(schema.assetRecallRequests.status, ['completed']),
      ),
    );

  return {
    ...record,
    imageUrl: attachment?.url ?? null,
    handoverHistory,
    activeRecall: activeRecall ?? null,
  };
}

export function findHandoverHistory(db: Database, assetId: string) {
  return db
    .select({
      id: schema.assetHandoverHistory.id,
      handoverType: schema.assetHandoverHistory.handoverType,
      handoverDate: schema.assetHandoverHistory.handoverDate,
      status: schema.assetHandoverHistory.status,
      note: schema.assetHandoverHistory.note,
      recipientName: schema.employees.fullName,
      departmentName: schema.departments.name,
    })
    .from(schema.assetHandoverHistory)
    .leftJoin(
      schema.employees,
      eq(schema.assetHandoverHistory.receivedByEmployeeId, schema.employees.id),
    )
    .leftJoin(
      schema.departments,
      eq(
        schema.assetHandoverHistory.receivedByDepartmentId,
        schema.departments.id,
      ),
    )
    .where(eq(schema.assetHandoverHistory.assetId, assetId))
    .orderBy(desc(schema.assetHandoverHistory.handoverDate));
}
