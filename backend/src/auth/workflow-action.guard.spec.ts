import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { WorkflowActionGuard } from './workflow-action.guard.js';
import { WORKFLOW_ACTIONS } from './workflow-actions.config.js';

function contextFor(roleName: string, isDepartmentHead = false) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ user: { roleName, isDepartmentHead } }),
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
    const guard = guardFor(WORKFLOW_ACTIONS.purchaseApproveFinance);
    expect(guard.canActivate(contextFor('ACCOUNTING'))).toBe(true);
  });

  it('từ chối role không có hành động tương ứng', () => {
    const guard = guardFor(WORKFLOW_ACTIONS.purchaseApproveExecutive);
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
    const financeGuard = guardFor(WORKFLOW_ACTIONS.purchaseApproveFinance);

    expect(reportGuard.canActivate(contextFor('Quản lý'))).toBe(true);
    expect(() => financeGuard.canActivate(contextFor('Quản lý'))).toThrow(
      ForbiddenException,
    );
  });
});
