import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  getAllowedWorkflowActions,
  WorkflowAction,
} from './workflow-actions.config.js';
import type { AuthenticatedEmployee } from './workflow-auth.types.js';

const WORKFLOW_ACTION_KEY = 'workflow-action';

type AuthenticatedRequest = Request & { user?: AuthenticatedEmployee };

/** Gắn hành động bắt buộc lên route để cấu hình quyền độc lập với controller. */
export const RequireWorkflowAction = (action: WorkflowAction) =>
  SetMetadata(WORKFLOW_ACTION_KEY, action);

@Injectable()
/** Đối chiếu hành động của route với role và cờ trưởng bộ phận của principal. */
export class WorkflowActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /** Kết hợp quyền của role với quyền trưởng phòng được khai báo cùng cấu hình. */
  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.getAllAndOverride<WorkflowAction>(
      WORKFLOW_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!action) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const employee = request.user;

    if (!employee)
      throw new ForbiddenException('Authenticated user is missing.');

    const allowedActions = getAllowedWorkflowActions(
      employee.roleName,
      employee.isDepartmentHead,
      employee.departmentName,
    );

    if (!allowedActions.includes(action)) {
      throw new ForbiddenException(`Role is not allowed to perform ${action}.`);
    }

    return true;
  }
}
