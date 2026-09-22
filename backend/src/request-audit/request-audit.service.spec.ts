import { RequestAuditService } from './request-audit.service.js';

describe('RequestAuditService', () => {
  it('ghi đủ revision, actor scope và status transition cho purchase', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const transaction = { insert: vi.fn(() => ({ values })) };
    const service = new RequestAuditService({} as never);

    await service.logPurchase(transaction as never, {
      requestId: 'request-id',
      revision: 2,
      actionType: 'purchase.request.approve_department',
      actor: {
        id: 'actor-id',
        email: 'head@example.com',
        roleId: 'role-id',
        roleName: 'EMPLOYEE',
        departmentId: 'department-id',
        departmentName: 'WAREHOUSE',
        isDepartmentHead: true,
      },
      result: 'approved',
      previousStatus: 'pending_department_head',
      newStatus: 'pending_procurement_enrichment',
      entityType: 'request',
      entityId: 'request-id',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'purchase',
        requestId: 'request-id',
        workflowRevision: 2,
        actorDepartmentId: 'department-id',
        actorIsDepartmentHead: true,
        previousStatus: 'pending_department_head',
        newStatus: 'pending_procurement_enrichment',
        metadata: {
          entityType: 'request',
          entityId: 'request-id',
          revision: 2,
        },
      }),
    );
  });
});
