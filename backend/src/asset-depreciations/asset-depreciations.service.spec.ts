import { ForbiddenException, Logger } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { AssetDepreciationsService } from './asset-depreciations.service.js';

const actor: AuthenticatedEmployee = {
  id: 'staff',
  email: 'staff@example.com',
  roleId: 'role',
  roleName: 'EMPLOYEE',
  departmentId: 'department',
  departmentName: 'ACCOUNTING',
  isDepartmentHead: false,
};

describe('AssetDepreciationsService', () => {
  const database = { transaction: vi.fn() };
  const service = new AssetDepreciationsService(
    database as unknown as NodePgDatabase<typeof schema>,
  );

  afterEach(() => {
    service.onModuleDestroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rejects another department before accessing data', async () => {
    await expect(
      service.findAll({ ...actor, departmentName: 'IT' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('rejects approval by staff and preparation by the head', async () => {
    await expect(
      service.decide('period', { decision: 'approve' }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.submit('period', { ...actor, isDepartmentHead: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('retries scheduler failures and cancels the timer on shutdown', async () => {
    vi.useFakeTimers();
    const scheduled = new AssetDepreciationsService(
      database as unknown as NodePgDatabase<typeof schema>,
    );
    const ensure = vi
      .spyOn(scheduled, 'ensureDuePeriods')
      .mockRejectedValueOnce(new Error('database offline'))
      .mockResolvedValue(undefined);
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    scheduled.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(log).toHaveBeenCalledOnce();
    expect(ensure).toHaveBeenCalledTimes(2);
    scheduled.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ensure).toHaveBeenCalledTimes(2);
  });

  it('creates a missing month without attempting inserts for existing periods', async () => {
    const values = vi.fn().mockReturnValue({
      onConflictDoNothing: () => ({ returning: async () => [] }),
    });
    const from = vi
      .fn()
      .mockResolvedValueOnce([{ firstMonth: '2026-01-01' }])
      .mockResolvedValueOnce([
        { month: '2026-01-01' },
        { month: '2026-03-01' },
      ]);
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: () => ({ from }),
      insert: () => ({ values }),
    };
    const db = {
      transaction: async (run: (value: typeof tx) => Promise<void>) => run(tx),
    };
    const scheduled = new AssetDepreciationsService(
      db as unknown as NodePgDatabase<typeof schema>,
    );

    await scheduled.ensureDuePeriods(new Date('2026-04-15T12:00:00Z'));

    expect(values).toHaveBeenCalledExactlyOnceWith({ month: '2026-02-01' });
  });
});
