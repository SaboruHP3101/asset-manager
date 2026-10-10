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
    transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback(db),
    ),
  };

  return {
    db: db as unknown as NodePgDatabase<typeof schema>,
    insertedValues: () => insertedValues,
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
      { assetId: '550e8400-e29b-41d4-a716-446655440000', reason: '' },
      actor,
    );

    expect(database.insertedValues()).toEqual(
      expect.objectContaining({
        requestedBy: actor.id,
        requestingDepartmentId: actor.departmentId,
        originalLocation: 'Tầng 2',
        reason: null,
      }),
    );
    expect(audit.log).toHaveBeenCalledOnce();
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
        { assetId: '550e8400-e29b-41d4-a716-446655440000' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
