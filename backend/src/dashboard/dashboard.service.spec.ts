import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import type { AssetAllocationsService } from '../asset-allocations/asset-allocations.service.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import type { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service.js';
import type { PurchaseReceiptsService } from '../purchase-receipts/purchase-receipts.service.js';
import type { PurchaseRequestsService } from '../purchase-requests/purchase-requests.service.js';
import { DashboardService } from './dashboard.service.js';

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
      findQueue: vi.fn(async () => [{ id: 'request-id' }]),
    },
    orders: {
      findEligibleRequests: vi.fn(async () => [
        { itemId: 'item-1' },
        { itemId: 'item-2' },
      ]),
      findApprovalQueue: vi.fn(async () => [{ id: 'order-approval' }]),
      findAll: vi.fn(async () => [
        { id: 'order-issued', status: 'issued' },
        { id: 'order-draft', status: 'draft' },
      ]),
    },
    receipts: {
      findInspectionQueue: vi.fn(async () => [{ unitId: 'unit-id' }]),
    },
    allocations: {
      findQueue: vi.fn(async () => [{ assetId: 'asset-id' }]),
    },
  };
}

describe('DashboardService', () => {
  it('không tải hoặc trả hàng chờ nghiệp vụ khi nhân viên không có quyền', async () => {
    const services = createServices();
    const service = new DashboardService(
      createDatabase([4, 1, 2, 3]),
      services.requests as unknown as PurchaseRequestsService,
      services.orders as unknown as PurchaseOrdersService,
      services.receipts as unknown as PurchaseReceiptsService,
      services.allocations as unknown as AssetAllocationsService,
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
      },
    });
    expect(services.requests.findQueue).not.toHaveBeenCalled();
    expect(services.orders.findEligibleRequests).not.toHaveBeenCalled();
    expect(services.orders.findApprovalQueue).not.toHaveBeenCalled();
    expect(services.orders.findAll).not.toHaveBeenCalled();
    expect(services.receipts.findInspectionQueue).not.toHaveBeenCalled();
    expect(services.allocations.findQueue).toHaveBeenCalledOnce();
  });

  it('tính công việc đúng phạm vi của nhân viên Thu mua', async () => {
    const services = createServices();
    const service = new DashboardService(
      createDatabase([2, 1, 0, 1]),
      services.requests as unknown as PurchaseRequestsService,
      services.orders as unknown as PurchaseOrdersService,
      services.receipts as unknown as PurchaseReceiptsService,
      services.allocations as unknown as AssetAllocationsService,
    );

    const result = await service.getMySummary(
      createActor({
        roleName: 'PROCUREMENT',
        departmentName: 'PROCUREMENT',
      }),
    );

    expect(result.pendingTasks).toEqual({
      purchaseRequests: 1,
      purchaseOrders: 3,
      inspections: 1,
      allocations: 1,
    });
    expect(services.requests.findQueue).toHaveBeenCalledOnce();
    expect(services.orders.findEligibleRequests).toHaveBeenCalledOnce();
    expect(services.orders.findApprovalQueue).not.toHaveBeenCalled();
    expect(services.orders.findAll).toHaveBeenCalledOnce();
    expect(services.receipts.findInspectionQueue).toHaveBeenCalledOnce();
  });
});
