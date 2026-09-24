import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import type { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { RequestAuditService } from '../request-audit/request-audit.service.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';

const actor: AuthenticatedEmployee = {
  id: 'procurement-head-id',
  email: 'head@example.com',
  roleId: 'role-id',
  roleName: 'PROCUREMENT',
  departmentId: 'procurement-id',
  departmentName: 'PROCUREMENT',
  isDepartmentHead: true,
};

function serviceFor(owner: 'it' | 'procurement') {
  const request = {
    id: 'request-id',
    requestCode: 'PR-2026-TEST',
    status: 'pending_procurement_head',
    currentRevision: 1,
    requesterId: 'requester-id',
    departmentId: 'request-department-id',
  };
  const rows = [
    [request],
    [{ id: 'revision-id' }],
    [{ id: 'item-id', managementOwnerSnapshot: owner }],
    [{ requestItemId: 'item-id', isSelected: true }],
    [{ id: 'revision-id' }],
    [{ id: 'item-id', managementOwnerSnapshot: owner }],
    [{ id: 'it-head-id' }],
  ];
  let selectIndex = 0;
  const select = vi.fn(() => {
    const result = rows[selectIndex++] ?? [];
    const query = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue(result),
    };
    const promise = Object.assign(Promise.resolve(result), {
      orderBy: query.orderBy,
    });
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(promise);
    return query;
  });
  const where = vi.fn().mockResolvedValue(undefined);
  const db = {
    select,
    update: vi.fn(() => ({ set: vi.fn(() => ({ where })) })),
    transaction: vi.fn((callback: (transaction: unknown) => Promise<unknown>) =>
      callback(db),
    ),
  };
  const authorization = {
    assertAction: vi.fn(),
    assertDepartment: vi.fn(),
    assertCanViewRequest: vi.fn(),
  };
  const audit = { logPurchase: vi.fn() };
  const notifications = { create: vi.fn(), createMany: vi.fn() };
  const service = new PurchaseRequestsService(
    db as never,
    authorization as unknown as PurchaseAuthorizationService,
    audit as unknown as RequestAuditService,
    notifications as unknown as NotificationsService,
  );
  vi.spyOn(service, 'findOne').mockResolvedValue({ id: request.id } as never);
  return { service, audit, notifications };
}

describe('PurchaseRequestsService approvals', () => {
  it('đề nghị không điện tử hoàn tất ở Trưởng Thu mua', async () => {
    const { service, audit, notifications } = serviceFor('procurement');

    await service.decideProcurement('request-id', { approved: true }, actor);

    expect(audit.logPurchase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ newStatus: 'approved' }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'purchase_request_approved' }),
    );
  });

  it('đề nghị có hạng mục điện tử chuyển sang Trưởng IT', async () => {
    const { service, audit, notifications } = serviceFor('it');

    await service.decideProcurement('request-id', { approved: true }, actor);

    expect(audit.logPurchase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ newStatus: 'pending_it_head' }),
    );
    expect(notifications.createMany).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'purchase_request_ready_for_it_head',
        }),
      ]),
    );
  });
});
