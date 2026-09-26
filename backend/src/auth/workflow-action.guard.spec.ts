import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { WorkflowActionGuard } from './workflow-action.guard.js';
import { WORKFLOW_ACTIONS } from './workflow-actions.config.js';

function contextFor(
  roleName: string,
  isDepartmentHead = false,
  departmentName = 'WAREHOUSE',
) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: { roleName, isDepartmentHead, departmentName },
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
  it('cho phép role thực hiện hành động đã cấu hình', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.repairAssess);

    expect(guard.canActivate(contextFor('IT'))).toBe(true);
  });

  it('từ chối role không có hành động tương ứng', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.repairAssess);

    expect(() => guard.canActivate(contextFor('EMPLOYEE'))).toThrow(
      ForbiddenException,
    );
  });

  it('cấp hành động duyệt phòng ban theo cờ isDepartmentHead', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.repairApproveDepartment);

    expect(guard.canActivate(contextFor('IT', true))).toBe(true);
  });

  it('cho phép role chuyên môn sử dụng hành động tự phục vụ của nhân viên', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.repairReport);

    expect(guard.canActivate(contextFor('IT'))).toBe(true);
    expect(guard.canActivate(contextFor('ACCOUNTING'))).toBe(true);
  });

  it('cho phép role mới hoặc role cũ tạo request nhưng không cấp quyền chuyên môn', () => {
    const reportGuard = guardFor(WORKFLOW_ACTIONS.repairReport);
    const assessGuard = guardFor(WORKFLOW_ACTIONS.repairAssess);

    expect(reportGuard.canActivate(contextFor('Quản lý'))).toBe(true);
    expect(() => assessGuard.canActivate(contextFor('Quản lý'))).toThrow(
      ForbiddenException,
    );
  });

  it('cấp quyền purchase theo phòng ban và cờ trưởng phòng', () => {
    expect(
      guardFor(WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement).canActivate(
        contextFor('EMPLOYEE', false, 'PROCUREMENT'),
      ),
    ).toBe(true);
    expect(
      guardFor(WORKFLOW_ACTIONS.purchaseRequestApproveProcurement).canActivate(
        contextFor('EMPLOYEE', true, 'PROCUREMENT'),
      ),
    ).toBe(true);
    expect(
      guardFor(WORKFLOW_ACTIONS.purchaseRequestApproveIt).canActivate(
        contextFor('EMPLOYEE', true, 'IT'),
      ),
    ).toBe(true);
  });

  it('không cấp quyền purchase approval cho Accounting hoặc Executive', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.purchaseRequestApproveProcurement);

    expect(() =>
      guard.canActivate(contextFor('ACCOUNTING', true, 'ACCOUNTING')),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(contextFor('EXECUTIVE', true, 'EXECUTIVE')),
    ).toThrow(ForbiddenException);
  });
});
