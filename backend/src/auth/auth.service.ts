import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmployeesService } from '../employees/employees.service.js';
import { AuthDto } from './dto/auth.dto.js';
import { SetupPasswordDto } from './dto/setup-password.dto.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';

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
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
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
    try {
      // 1. Xác thực activation token gửi từ client lên
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token);

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
    } catch (error) {
      throw new BadRequestException('The token has expired or is incorrect.');
    }
  }
}
