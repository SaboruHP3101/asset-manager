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
      purchaseOrderId: 'it-order',
      purchaseOrderOwner: 'it',
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
      purchaseOrderId: null,
      purchaseOrderOwner: null,
    },
    {
      id: 'procurement-asset',
      assetCode: 'TS-03',
      purchaseOrderId: 'procurement-order',
      purchaseOrderOwner: 'procurement',
    },
  ];
  const leftJoin = vi.fn();
  const from = vi.fn();
  const select = vi.fn();
  const update = vi.fn();
  const set = vi.fn();
  const where = vi.fn();
  const returning = vi.fn();
  const lock = vi.fn();
  const values = vi.fn();
  const insert = vi.fn();
  const txFrom = vi.fn();
  const txSelect = vi.fn();
  const transaction = vi.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: DRIZZLE, useValue: { select, transaction } },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    update.mockReset().mockReturnValue({ set });
    set.mockReset().mockReturnValue({ where });
    where.mockReset().mockReturnValue({ returning });
    returning.mockReset();
    lock.mockReset().mockResolvedValue([rows[0]]);
    values.mockReset().mockResolvedValue(undefined);
    insert.mockReset().mockReturnValue({ values });
    txFrom.mockReset().mockReturnValue({ where: () => ({ for: lock }) });
    txSelect.mockReset().mockReturnValue({ from: txFrom });
    transaction
      .mockReset()
      .mockImplementation((callback: (tx: unknown) => unknown) =>
        callback({ select: txSelect, update, insert }),
      );
    select.mockReset().mockReturnValue({ from });
    from.mockReset().mockReturnValue({ leftJoin });
    leftJoin
      .mockReset()
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce({ leftJoin })
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
      schema.purchaseOrderItems,
      schema.purchaseRequestItems,
    ]);
    const fields = select.mock.calls[0][0];

    expect(fields.assetCode).toBe(schema.assets.assetCode);
    expect(fields.category).toBe(schema.assetCategories.name);
    expect(fields.assignedTo).toBe(schema.employees.fullName);
    expect(fields.department).toBe(schema.departments.name);
    expect(fields.purchaseOrderId).toBe(
      schema.purchaseOrderItems.purchaseOrderId,
    );
    expect(fields.purchaseOrderOwner).toBe(
      schema.purchaseRequestItems.managementOwnerSnapshot,
    );
    expect(fields).not.toHaveProperty('password');
  });

  it('returns an empty list when there are no assets', async () => {
    leftJoin
      .mockReset()
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce({ leftJoin })
      .mockResolvedValueOnce([]);

    await expect(service.findAll()).resolves.toEqual([]);
  });

  it('returns both history sources for the asset', async () => {
    const changes = [{ id: 'edit-id', employeeName: 'Nguyễn An' }];
    const handovers = [{ id: 'handover-id', recipientName: 'Nguyễn Bình' }];
    const orderBy = vi
      .fn()
      .mockResolvedValueOnce(changes)
      .mockResolvedValueOnce(handovers);
    const filter = { where: () => ({ orderBy }) };

    from.mockReturnValueOnce({ innerJoin: () => filter });
    leftJoin
      .mockReset()
      .mockReturnValueOnce({ leftJoin })
      .mockReturnValueOnce(filter);

    await expect(service.findHistory('second')).resolves.toEqual({
      changes,
      handovers,
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      schema.changeHistory,
      schema.assetHandoverHistory,
    ]);
  });

  it('updates supplied metadata without overwriting workflow fields', async () => {
    returning.mockResolvedValue([{ ...rows[0], name: 'Updated laptop' }]);

    await expect(
      service.update('second', { name: 'Updated laptop' }, 'employee-id'),
    ).resolves.toMatchObject({ name: 'Updated laptop', status: 'active' });
    expect(set).toHaveBeenCalledWith({
      name: 'Updated laptop',
      updatedAt: expect.any(Date),
    });
    expect(update).toHaveBeenCalledWith(schema.assets);
    expect(lock).toHaveBeenCalledWith('update');
    expect(insert).toHaveBeenCalledWith(schema.changeHistory);
    expect(values).toHaveBeenCalledWith({
      entityType: 'asset',
      entityId: 'second',
      action: 'update',
      oldData: { name: 'Laptop' },
      newData: { name: 'Updated laptop' },
      performedByEmployeeId: 'employee-id',
    });
  });

  it('skips the audit entry when stored values are equivalent', async () => {
    lock.mockResolvedValue([{ ...rows[0], initialValue: '1200.00' }]);
    returning.mockResolvedValue([{ ...rows[0], initialValue: '1200.0' }]);

    await service.update('second', { initialValue: '1200.0' }, 'employee-id');
    expect(insert).not.toHaveBeenCalled();
  });

  it('preserves a previously unset name in the audit entry', async () => {
    lock.mockResolvedValue([{ ...rows[0], name: null }]);
    returning.mockResolvedValue([rows[0]]);

    await service.update('second', { name: 'Laptop' }, 'employee-id');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        oldData: { name: null },
        newData: { name: 'Laptop' },
      }),
    );
  });

  it('fails the save when the audit record cannot be inserted', async () => {
    returning.mockResolvedValue([{ ...rows[0], name: 'Updated laptop' }]);
    values.mockRejectedValue(new Error('write failed'));

    await expect(
      service.update('second', { name: 'Updated laptop' }, 'employee-id'),
    ).rejects.toThrow('Không thể cập nhật tài sản');
  });

  it('reports missing records and database conflicts when saving', async () => {
    lock.mockResolvedValueOnce([]);
    await expect(
      service.update('missing', { name: 'Laptop' }, 'employee-id'),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();

    returning.mockRejectedValue(
      new DrizzleQueryError('query', [], new Error('duplicate')),
    );
    await expect(
      service.update('second', { assetCode: 'TS-01' }, 'employee-id'),
    ).rejects.toThrow(ConflictException);
    expect(insert).not.toHaveBeenCalled();
  });
});
