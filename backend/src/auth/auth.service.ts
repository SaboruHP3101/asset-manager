import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmployeesService } from '../employees/employees.service.js';
import { AuthDto } from './dto/auth.dto.js';
import { SetupPasswordDto } from './dto/setup-password.dto.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getAllowedWorkflowActions } from './workflow-actions.config.js';

type TokenPayload = {
  purpose: string;
  sub: string;
  email: string;
};

@Injectable()
export class AuthService {
  constructor(
    private employeesService: EmployeesService,
    private jwtService: JwtService,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async login(authDto: AuthDto) {
    // 1. Kiểm tra user
    const employee = await this.employeesService.findOneByEmail(authDto.email);

    if (employee.password === null) {
      return {
        firstTimeLogin: true,
        message:
          'The account has not been activated. Please set your password for the first time.',
        activationToken: await this.jwtService.signAsync(
          {
            sub: employee.id,
            email: employee.email,
            purpose: 'activation',
          } as TokenPayload,
          { expiresIn: '15m' }, // Token ngắn hạn chỉ dùng để đặt mật khẩu
        ),
      };
    }

    const isMatch = await bcrypt.compare(authDto.password, employee.password!);

    if (!isMatch) {
      throw new UnauthorizedException('Email or password does not match.');
    }

    if (!employee.isActive) {
      throw new UnauthorizedException('This account had been deactivated.');
    }

    // 2. Tạo JWT Payload chứa thông tin định danh
    const payload = {
      sub: employee.id,
      email: employee.email,
      role: employee.roleId,
    };

    // 3. Ký và trả về Access Token
    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  async setupFirstTimePassword(token: string, dto: SetupPasswordDto) {
    let payload: TokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(token);
    } catch {
      throw new BadRequestException('The token has expired or is incorrect.');
    }

    if (payload.purpose !== 'activation') {
      throw new BadRequestException('Invalid token for this operation.');
    }

    // 2. Băm mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    // 3. Cập nhật vào DB
    await this.db
      .update(schema.employees)
      .set({ password: hashedPassword })
      .where(eq(schema.employees.id, payload.sub));

    // 4. Trả về luôn Access Token chính thức để người dùng vào thẳng hệ thống
    return {
      message: 'Account activation successful.',
      access_token: await this.jwtService.signAsync({
        sub: payload.sub,
        email: payload.email,
      }),
    };
  }

  async checkEmail(email: string) {
    let employee;

    try {
      employee = await this.employeesService.findOneByEmail(email);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;

      return { exists: false };
    }

    if (employee.password === null) {
      return {
        exists: true,
        email: employee.email,
        firstTimeLogin: true,
        message:
          'The account has not been activated. Please set your password for the first time.',
        activationToken: await this.jwtService.signAsync(
          {
            sub: employee.id,
            email: employee.email,
            purpose: 'activation',
          } as TokenPayload,
          { expiresIn: '15m' },
        ),
      };
    }

    return { exists: true, email: employee.email, firstTimeLogin: false };
  }

  // Xác thực token và lấy thông tin nhân viên cùng phòng ban, vai trò
  async getProfile(authHeader?: string) {
    const employeeId = await this.getEmployeeId(authHeader);
    const [profile] = await this.db
      .select({
        employeeCode: schema.employees.employeeCode,
        fullName: schema.employees.fullName,
        email: schema.employees.email,
        phoneNumber: schema.employees.phoneNumber,
        department: schema.departments.name,
        role: schema.roles.name,
        isDepartmentHead: schema.employees.isDepartmentHead,
      })
      .from(schema.employees)
      .innerJoin(
        schema.departments,
        eq(schema.employees.departmentId, schema.departments.id),
      )
      .innerJoin(schema.roles, eq(schema.employees.roleId, schema.roles.id))
      .where(eq(schema.employees.id, employeeId));

    if (!profile) throw new UnauthorizedException('Account not found.');

    return {
      ...profile,
      allowedActions: getAllowedWorkflowActions(
        profile.role,
        profile.isDepartmentHead,
        profile.department,
      ),
    };
  }

  // Lấy mã nhân viên từ access token để dùng cho các API cá nhân
  async getEmployeeId(authHeader?: string) {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) throw new UnauthorizedException('Access token is required.');

    let payload: { sub?: unknown; purpose?: string };

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired.');
    }

    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      payload.purpose === 'activation'
    ) {
      throw new UnauthorizedException('Access token is invalid.');
    }

    return payload.sub;
  }
}
