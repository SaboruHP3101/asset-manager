import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AssetsService } from './assets.service.js';
import * as schema from '../db/schema.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';

describe('AssetsService', () => {
  let service: AssetsService;
  const rows = [
    {
      id: 'second',
      assetCode: 'TS-02',
      name: 'Laptop',
      category: 'Máy tính',
      assignedTo: 'Nguyễn An',
      department: 'IT',
      location: 'Tầng 2',
      status: 'active',
    },
    {
      id: 'first',
      assetCode: 'TS-01',
      name: 'Monitor',
      category: 'Màn hình',
      assignedTo: null,
      department: null,
      location: 'Kho IT',
      status: 'available',
    },
  ];
  const leftJoin = vi.fn();
  const from = vi.fn();
  const select = vi.fn();
  const update = vi.fn();
  const set = vi.fn();
  const where = vi.fn();
  const returning = vi.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: DRIZZLE, useValue: { select, update } },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    update.mockReset().mockReturnValue({ set });
    set.mockReset().mockReturnValue({ where });
    where.mockReset().mockReturnValue({ returning });
    returning.mockReset();
    select.mockReset().mockReturnValue({ from });
    from.mockReset().mockReturnValue({ leftJoin });
    leftJoin
      .mockReset()
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce({ leftJoin })
      .mockResolvedValueOnce(rows);
  });

  it('joins display fields without reordering or dropping unassigned assets', async () => {
    await expect(service.findAll()).resolves.toEqual(rows);
    expect(from).toHaveBeenCalledWith(schema.assets);
    expect(leftJoin.mock.calls.map(([table]) => table)).toEqual([
      schema.assetCategories,
      schema.employees,
      schema.departments,
      schema.warehouses,
    ]);
    const fields = select.mock.calls[0][0];

    expect(fields.assetCode).toBe(schema.assets.assetCode);
    expect(fields.category).toBe(schema.assetCategories.name);
    expect(fields.assignedTo).toBe(schema.employees.fullName);
    expect(fields.department).toBe(schema.departments.name);
    expect(fields).not.toHaveProperty('password');
  });

  it('returns an empty list when there are no assets', async () => {
    leftJoin
      .mockReset()
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce({ leftJoin })
      .mockResolvedValueOnce([]);

    await expect(service.findAll()).resolves.toEqual([]);
  });

  it('updates supplied metadata without overwriting workflow fields', async () => {
    returning.mockResolvedValue([{ ...rows[0], name: 'Updated laptop' }]);

    await expect(
      service.update('second', { name: 'Updated laptop' }),
    ).resolves.toMatchObject({ name: 'Updated laptop', status: 'active' });
    expect(set).toHaveBeenCalledWith({
      name: 'Updated laptop',
      updatedAt: expect.any(Date),
    });
    expect(update).toHaveBeenCalledWith(schema.assets);
  });

  it('reports missing records and database conflicts when saving', async () => {
    returning.mockResolvedValue([]);
    await expect(service.update('missing', { name: 'Laptop' })).rejects.toThrow(
      NotFoundException,
    );

    returning.mockRejectedValue(
      new DrizzleQueryError('query', [], new Error('duplicate')),
    );
    await expect(
      service.update('second', { assetCode: 'TS-01' }),
    ).rejects.toThrow(ConflictException);
  });
});
