import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import type { AssetAllocationsService } from '../asset-allocations/asset-allocations.service.js';
import type { AssetRecallRequestsService } from '../asset-recall-requests/asset-recall-requests.service.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import type { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service.js';
import type { PurchaseReceiptsService } from '../purchase-receipts/purchase-receipts.service.js';
import type { PurchaseRequestsService } from '../purchase-requests/purchase-requests.service.js';
import { DashboardService } from './dashboard.service.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { countQueue as countAllocations } from '../asset-allocations/allocation-queue.js';
import { countQueue as countRequests } from '../purchase-requests/purchase-request-queries.js';
import { countQueue as countRecalls } from '../asset-recall-requests/recall-queries.js';

function createDatabase(counts: number[]) {
  const remaining = [...counts];

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ value: remaining.shift() ?? 0 }]),
      })),
    })),
  } as unknown as NodePgDatabase<typeof schema>;
}

function createActor(
  overrides: Partial<AuthenticatedEmployee> = {},
): AuthenticatedEmployee {
  return {
    id: 'employee-id',
    email: 'employee@example.com',
    roleId: 'role-id',
    roleName: 'EMPLOYEE',
    departmentId: 'department-id',
    departmentName: 'ACCOUNTING',
    isDepartmentHead: false,
    ...overrides,
  };
}

function createServices() {
  return {
    requests: {
      countQueue: vi.fn(async () => 1),
    },
    orders: {
      countEligibleRequests: vi.fn(async () => 2),
      countApprovalQueue: vi.fn(async () => 1),
      countOrderTasks: vi.fn(async () => ({ draft: 1, ongoing: 1 })),
    },
    receipts: {
      countInspectionQueue: vi.fn(async () => 1),
    },
    allocations: {
      countQueue: vi.fn(async () => 1),
    },
    recalls: {
      countQueue: vi.fn(async () => 0),
    },
  };
}

describe('DashboardService', () => {
  it('counts scoped queues in SQL without loading queue details or progress', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ count: '2' }] });
    const db = drizzle({ client: { query } as unknown as Pool, schema });
    const actor = createActor({ isDepartmentHead: true });

    await expect(countRequests(db, actor)).resolves.toBe(2);
    await expect(countRecalls(db, actor)).resolves.toBe(2);
    await expect(countAllocations(db, actor)).resolves.toBe(4);

    expect(query).toHaveBeenCalledTimes(4);

    for (const [statement, parameters] of query.mock.calls) {
      expect(statement.text).toMatch(/^select count\(\*\) as count from/);
      expect(parameters).toContain(actor.departmentId);
    }
  });
  it('không tải hoặc trả hàng chờ nghiệp vụ khi nhân viên không có quyền', async () => {
    const services = createServices();
    const service = new DashboardService(
      createDatabase([4, 1, 2, 3, 0]),
      services.requests as unknown as PurchaseRequestsService,
      services.orders as unknown as PurchaseOrdersService,
      services.receipts as unknown as PurchaseReceiptsService,
      services.allocations as unknown as AssetAllocationsService,
      services.recalls as unknown as AssetRecallRequestsService,
    );

    const result = await service.getMySummary(createActor());

    expect(result).toEqual({
      assignedAssets: 4,
      activeRequests: 6,
      pendingTasks: {
        purchaseRequests: 0,
        purchaseOrders: 0,
        inspections: 0,
        allocations: 1,
        recalls: 0,
      },
    });
    expect(services.requests.countQueue).not.toHaveBeenCalled();
    expect(services.orders.countEligibleRequests).not.toHaveBeenCalled();
    expect(services.orders.countApprovalQueue).not.toHaveBeenCalled();
    expect(services.orders.countOrderTasks).not.toHaveBeenCalled();
    expect(services.receipts.countInspectionQueue).not.toHaveBeenCalled();
    expect(services.allocations.countQueue).toHaveBeenCalledOnce();
  });

  it('tính công việc đúng phạm vi của nhân viên Thu mua', async () => {
    const services = createServices();
    const service = new DashboardService(
      createDatabase([2, 1, 0, 1, 0]),
      services.requests as unknown as PurchaseRequestsService,
      services.orders as unknown as PurchaseOrdersService,
      services.receipts as unknown as PurchaseReceiptsService,
      services.allocations as unknown as AssetAllocationsService,
      services.recalls as unknown as AssetRecallRequestsService,
    );

    const result = await service.getMySummary(
      createActor({
        roleName: 'PROCUREMENT',
        departmentName: 'PROCUREMENT',
      }),
    );

    expect(result.pendingTasks).toEqual({
      purchaseRequests: 1,
      purchaseOrders: 4,
      inspections: 1,
      allocations: 1,
      recalls: 0,
    });
    expect(services.requests.countQueue).toHaveBeenCalledOnce();
    expect(services.orders.countEligibleRequests).toHaveBeenCalledOnce();
    expect(services.orders.countApprovalQueue).not.toHaveBeenCalled();
    expect(services.orders.countOrderTasks).toHaveBeenCalledOnce();
    expect(services.receipts.countInspectionQueue).toHaveBeenCalledOnce();
  });
});
