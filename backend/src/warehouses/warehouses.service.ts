import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';

@Injectable()
export class WarehousesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findItWarehouse(actor: AuthenticatedEmployee) {
    this.assertItDepartment(actor);
    const [warehouse] = await this.db
      .select()
      .from(schema.warehouses)
      .where(
        and(
          eq(schema.warehouses.code, 'IT_WAREHOUSE'),
          eq(schema.warehouses.isActive, true),
        ),
      );

    if (!warehouse) throw new NotFoundException('Không tìm thấy kho IT.');

    return warehouse;
  }

  async findItAssets(actor: AuthenticatedEmployee) {
    const warehouse = await this.findItWarehouse(actor);

    return this.db
      .select({
        id: schema.assets.id,
        assetCode: schema.assets.assetCode,
        name: schema.assets.name,
        status: schema.assets.status,
        category: schema.assetCategories.name,
      })
      .from(schema.assets)
      .innerJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .where(
        and(
          eq(schema.assets.currentWarehouseId, warehouse.id),
          isNotNull(schema.assets.currentWarehouseId),
        ),
      )
      .orderBy(asc(schema.assets.assetCode));
  }

  private assertItDepartment(actor: AuthenticatedEmployee) {
    if (actor.departmentName !== 'IT') {
      throw new NotFoundException('Không tìm thấy kho IT.');
    }
  }
}
