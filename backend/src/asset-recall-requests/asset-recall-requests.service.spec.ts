import { BadRequestException } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import type { RequestAuditService } from '../request-audit/request-audit.service.js';
import { AssetRecallRequestsService } from './asset-recall-requests.service.js';

const actor: AuthenticatedEmployee = {
  id: 'employee-id',
  email: 'employee@example.com',
  roleId: 'role-id',
  roleName: 'EMPLOYEE',
  departmentId: 'department-id',
  departmentName: 'WAREHOUSE',
  isDepartmentHead: false,
};

function databaseWithSelects(selectResults: unknown[][]) {
  let insertedValues: unknown;
  const updatedValues: unknown[] = [];
  const db = {
    execute: vi.fn(async () => ({ rows: [{ id: 'asset-id' }] })),
    select: vi.fn(() => {
      const result = selectResults.shift() ?? [];
      const query = {
        from: () => query,
        innerJoin: () => query,
        where: async () => result,
      };

      return query;
    }),
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        insertedValues = values;

        return {
          returning: async () => [{ id: 'recall-id' }],
        };
      },
    })),
    update: vi.fn(() => ({
      set: (values: unknown) => {
        updatedValues.push(values);

        return { where: vi.fn(async () => []) };
      },
    })),
    transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback(db),
    ),
  };

  return {
    db: db as unknown as NodePgDatabase<typeof schema>,
    insertedValues: () => insertedValues,
    updatedValues,
  };
}

describe('AssetRecallRequestsService', () => {
  it('tạo draft cho tài sản IT đang thuộc employee', async () => {
    const database = databaseWithSelects([
      [
        {
          id: 'asset-id',
          currentUserId: actor.id,
          managementOwner: 'it',
          currentLocation: 'Tầng 2',
        },
      ],
      [],
    ]);
    const audit = { log: vi.fn(async () => undefined) };
    const service = new AssetRecallRequestsService(
      database.db,
      audit as unknown as RequestAuditService,
    );

    vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'recall-id' });

    await service.create(
      {
        type: 'exchange',
        assetId: '550e8400-e29b-41d4-a716-446655440000',
        reason: '',
      },
      actor,
    );

    expect(database.insertedValues()).toEqual(
      expect.objectContaining({
        requestedBy: actor.id,
        requestingDepartmentId: actor.departmentId,
        originalLocation: 'Tầng 2',
        reason: null,
        type: 'exchange',
      }),
    );
    expect(audit.log).toHaveBeenCalledOnce();
  });

  it('lưu loại disposal trên draft', async () => {
    const database = databaseWithSelects([
      [
        {
          id: 'asset-id',
          currentUserId: actor.id,
          managementOwner: 'it',
          currentLocation: 'Tầng 2',
        },
      ],
      [],
    ]);
    const service = new AssetRecallRequestsService(database.db, {
      log: vi.fn(async () => undefined),
    } as unknown as RequestAuditService);

    vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'recall-id' });
    await service.create(
      {
        type: 'disposal',
        assetId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Không còn khả năng sử dụng',
      },
      actor,
    );

    expect(database.insertedValues()).toEqual(
      expect.objectContaining({ type: 'disposal' }),
    );
  });

  it('từ chối tài sản không do IT quản lý', async () => {
    const database = databaseWithSelects([
      [
        {
          id: 'asset-id',
          currentUserId: actor.id,
          managementOwner: 'procurement',
          currentLocation: 'Tầng 2',
        },
      ],
    ]);
    const service = new AssetRecallRequestsService(database.db, {
      log: vi.fn(),
    } as unknown as RequestAuditService);

    await expect(
      service.create(
        {
          type: 'exchange',
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('hoàn tất báo phế và xóa current custody', async () => {
    const itHead = {
      ...actor,
      departmentId: 'it-department-id',
      departmentName: 'IT',
      isDepartmentHead: true,
    };
    const database = databaseWithSelects([
      [
        {
          id: 'recall-id',
          type: 'disposal',
          status: 'in_progress',
          assetId: 'asset-id',
          currentRevision: 1,
        },
      ],
      [
        {
          id: 'warehouse-id',
          code: 'IT_WAREHOUSE',
          managingDepartmentId: 'it-department-id',
        },
      ],
      [
        {
          id: 'asset-id',
          currentUserId: null,
          currentWarehouseId: 'warehouse-id',
          status: 'awaiting_disposal',
          managementOwner: 'it',
        },
      ],
    ]);
    const audit = { log: vi.fn(async () => undefined) };
    const service = new AssetRecallRequestsService(
      database.db,
      audit as unknown as RequestAuditService,
    );

    vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'recall-id' });
    await service.completeDisposal(
      'recall-id',
      {
        disposalDate: '2026-10-11',
        disposalMethod: 'Bàn giao xử lý rác điện tử',
      },
      itHead,
    );

    expect(database.updatedValues).toContainEqual(
      expect.objectContaining({
        status: 'disposed',
        currentUserId: null,
        currentManagingDepartmentId: null,
        currentWarehouseId: null,
        currentLocation: null,
      }),
    );
    expect(database.updatedValues).toContainEqual(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(audit.log).toHaveBeenCalledOnce();
  });
});
