import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import type { AuthenticatedEmployee } from './workflow-auth.types.js';

type AuthenticatedRequest = Request & { user?: AuthenticatedEmployee };

@Injectable()
/** Xác thực access token và tạo principal hiện hành cho các guard phía sau sử dụng. */
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * JWT chỉ cung cấp định danh. Thông tin quyền được đọc lại từ DB để việc đổi
   * role, phòng ban hoặc vô hiệu hóa tài khoản có hiệu lực ngay với token cũ.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) throw new UnauthorizedException('Access token is required.');

    let payload: { sub?: string; email?: string; purpose?: string };

    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired.');
    }

    if (!payload.sub || payload.purpose === 'activation') {
      throw new UnauthorizedException('Access token is invalid.');
    }

    const [employee] = await this.db
      .select({
        id: schema.employees.id,
        email: schema.employees.email,
        roleId: schema.employees.roleId,
        roleName: schema.roles.name,
        departmentId: schema.employees.departmentId,
        departmentName: schema.departments.name,
        isDepartmentHead: schema.employees.isDepartmentHead,
        isActive: schema.employees.isActive,
      })
      .from(schema.employees)
      .innerJoin(schema.roles, eq(schema.employees.roleId, schema.roles.id))
      .innerJoin(
        schema.departments,
        eq(schema.employees.departmentId, schema.departments.id),
      )
      .where(eq(schema.employees.id, payload.sub));

    if (!employee?.isActive) {
      throw new UnauthorizedException('Account not found or inactive.');
    }

    request.user = employee;

    return true;
  }
}
