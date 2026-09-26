import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedEmployee } from './workflow-auth.types.js';

type AuthenticatedRequest = Request & { user?: AuthenticatedEmployee };

/** Lấy principal đã được JWT guard xác thực, không nhận danh tính từ request body. */
export const CurrentEmployee = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedEmployee => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.user!;
  },
);
