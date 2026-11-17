import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { warehouses } from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { WarehousesService } from './warehouses.service.js';

const actor: AuthenticatedEmployee = {
  id: 'employee',
  email: 'it@example.test',
  departmentId: 'it',
  departmentName: 'IT',
  isDepartmentHead: false,
};

describe('WarehousesService', () => {
  const where = vi.fn<(filter: SQL) => Promise<unknown[]>>();
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  let service: WarehousesService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [WarehousesService, { provide: DRIZZLE, useValue: { select } }],
    }).compile();

    service = module.get(WarehousesService);
  });

  it('looks up the active IT warehouse by its fixed code', async () => {
    const warehouse = { id: 'warehouse', code: 'IT_WAREHOUSE', isActive: true };

    where.mockResolvedValueOnce([warehouse]);

    await expect(service.findItWarehouse(actor)).resolves.toBe(warehouse);
    expect(from).toHaveBeenCalledWith(warehouses);

    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);

    expect(query.sql).toBe(
      '("warehouses"."code" = $1 and "warehouses"."is_active" = $2)',
    );
    expect(query.params).toEqual(['IT_WAREHOUSE', true]);
  });

  it('returns a not-found error when the active warehouse is missing', async () => {
    where.mockResolvedValueOnce([]);

    await expect(service.findItWarehouse(actor)).rejects.toThrow(
      new NotFoundException('Không tìm thấy kho IT.'),
    );
  });

  it('returns a not-found error before querying for non-IT actors', async () => {
    await expect(
      service.findItWarehouse({ ...actor, departmentName: 'OPERATIONS' }),
    ).rejects.toThrow(new NotFoundException('Không tìm thấy kho IT.'));
    expect(select).not.toHaveBeenCalled();
  });
});
