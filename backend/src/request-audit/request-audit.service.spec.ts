import { RequestAuditService } from './request-audit.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { RequestAuditController } from './request-audit.controller.js';
import type { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';

describe.each(['repair', 'transfer'] as const)(
  '%s audit visibility',
  (requestType) => {
    const actor: AuthenticatedEmployee = {
      id: 'outsider',
      email: 'user@example.test',
      roleId: 'role',
      roleName: 'EMPLOYEE',
      departmentId: 'other',
      departmentName: 'ACCOUNTING',
      isDepartmentHead: false,
    };
    const request = {
      reporterId: 'requester',
      initiatedBy: 'requester',
      assignedTo: 'participant',
      toUserId: 'participant',
      departmentId: 'source',
      fromDepartmentId: 'source',
      toDepartmentId: 'target',
    };
    const where = vi.fn();
    const db = { select: () => ({ from: () => ({ where }) }) };
    const service = new RequestAuditService(
      db as unknown as NodePgDatabase<typeof schema>,
    );

    beforeEach(() => where.mockResolvedValue([request]));

    it('allows requester, participant, relevant head, and IT', async () => {
      for (const allowed of [
        { ...actor, id: 'requester' },
        { ...actor, id: 'participant' },
        { ...actor, departmentId: 'source', isDepartmentHead: true },
        { ...actor, departmentName: 'IT' },
      ]) {
        await expect(
          service.assertCanViewWorkflowTrail(requestType, 'request', allowed),
        ).resolves.toBeUndefined();
      }

      if (requestType === 'transfer') {
        await expect(
          service.assertCanViewWorkflowTrail(requestType, 'request', {
            ...actor,
            departmentId: 'target',
            isDepartmentHead: true,
          }),
        ).resolves.toBeUndefined();
      }
    });

    it('denies unrelated employees, same-department staff, and unrelated heads', async () => {
      for (const denied of [
        actor,
        { ...actor, departmentId: 'source' },
        { ...actor, isDepartmentHead: true },
      ]) {
        await expect(
          service.assertCanViewWorkflowTrail(requestType, 'request', denied),
        ).rejects.toThrow(ForbiddenException);
      }
    });

    it('rejects a missing request', async () => {
      where.mockResolvedValue([]);
      await expect(
        service.assertCanViewWorkflowTrail(requestType, 'missing', actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('checks access before the controller loads the timeline', async () => {
      const trail = vi.spyOn(service, 'findTrail');
      const controller = new RequestAuditController(
        service,
        {} as PurchaseAuthorizationService,
      );

      await expect(
        controller.findTrail(requestType, 'request', actor),
      ).rejects.toThrow(ForbiddenException);
      expect(trail).not.toHaveBeenCalled();
      trail.mockRestore();
    });
  },
);

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
