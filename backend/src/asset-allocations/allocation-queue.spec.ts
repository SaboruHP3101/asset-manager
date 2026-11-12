import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { findQueue } from './allocation-queue.js';

describe('allocation queue progress', () => {
  it('includes activated assets in progress without adding them to the queue', async () => {
    const candidate = {
      assetId: 'pending-asset',
      requestId: 'request-id',
      requestDepartmentId: 'department-id',
      status: 'awaiting_allocation',
      managementOwner: 'it',
    };
    const results = [
      [candidate],
      [],
      [candidate, { ...candidate, assetId: 'active-asset', status: 'active' }],
    ];
    const db = {
      select: vi.fn(() => {
        const result = results.shift();
        const query = {
          from: () => query,
          innerJoin: () => query,
          leftJoin: () => query,
          where: vi.fn(() => query),
          orderBy: async () => result,
        };

        return query;
      }),
    };
    const actor = {
      id: 'head-id',
      departmentId: 'department-id',
      departmentName: 'WAREHOUSE',
      roleName: 'EMPLOYEE',
      isDepartmentHead: true,
    } as AuthenticatedEmployee;

    const result = await findQueue(db as never, actor);

    expect(result).toEqual([
      expect.objectContaining({
        assetId: 'pending-asset',
        queueType: 'initial',
        totalAssets: 2,
        allocatedAssets: 1,
        pendingAssets: 1,
      }),
    ]);

    for (const call of db.select.mock.results) {
      expect(call.value.where).toHaveBeenCalledOnce();
    }
  });
});
