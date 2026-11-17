import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { WorkflowActionGuard } from './workflow-action.guard.js';
import { WORKFLOW_ACTIONS } from './workflow-actions.config.js';

function contextFor(isDepartmentHead = false, departmentName = 'WAREHOUSE') {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: { isDepartmentHead, departmentName },
      }),
    }),
  } as unknown as ExecutionContext;
}

function guardFor(action: string) {
  const reflector = {
    getAllAndOverride: () => action,
  } as unknown as Reflector;

  return new WorkflowActionGuard(reflector);
}

describe('WorkflowActionGuard', () => {
  it('allows IT department staff to assess repairs without a role', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.repairAssess);

    expect(guard.canActivate(contextFor(false, 'IT'))).toBe(true);
  });

  it('rejects employees outside the permitted department', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.repairAssess);

    expect(() => guard.canActivate(contextFor(false, 'WAREHOUSE'))).toThrow(
      ForbiddenException,
    );
  });

  it('cấp hành động duyệt phòng ban theo cờ isDepartmentHead', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.repairApproveDepartment);

    expect(guard.canActivate(contextFor(true))).toBe(true);
  });

  it('allows self-service actions across departments', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.repairReport);

    expect(guard.canActivate(contextFor(false, 'IT'))).toBe(true);
    expect(guard.canActivate(contextFor(false, 'ACCOUNTING'))).toBe(true);
  });

  it('allows self-service but not IT actions for unknown departments', () => {
    const reportGuard = guardFor(WORKFLOW_ACTIONS.repairReport);
    const assessGuard = guardFor(WORKFLOW_ACTIONS.repairAssess);

    expect(reportGuard.canActivate(contextFor(false, 'Quản lý'))).toBe(true);
    expect(() => assessGuard.canActivate(contextFor(false, 'Quản lý'))).toThrow(
      ForbiddenException,
    );
  });

  it('cấp quyền purchase theo phòng ban và cờ trưởng phòng', () => {
    expect(
      guardFor(WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement).canActivate(
        contextFor(false, 'PROCUREMENT'),
      ),
    ).toBe(true);
    expect(
      guardFor(WORKFLOW_ACTIONS.purchaseRequestApproveProcurement).canActivate(
        contextFor(true, 'PROCUREMENT'),
      ),
    ).toBe(true);
    expect(
      guardFor(WORKFLOW_ACTIONS.purchaseRequestApproveIt).canActivate(
        contextFor(true, 'IT'),
      ),
    ).toBe(true);
  });

  it('không cấp quyền purchase approval cho Accounting hoặc Executive', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.purchaseRequestApproveProcurement);

    expect(() => guard.canActivate(contextFor(true, 'ACCOUNTING'))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contextFor(true, 'EXECUTIVE'))).toThrow(
      ForbiddenException,
    );
  });
});
