import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { ConfigService } from '@nestjs/config';
import { EmployeesModule } from '../employees/employees.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { WorkflowActionGuard } from './workflow-action.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      global: true,
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // Giữ phiên đăng nhập trong một ngày
          expiresIn: '1d',
        },
      }),
    }),
    EmployeesModule,
    DrizzleModule,
  ],
  providers: [AuthService, JwtAuthGuard, WorkflowActionGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, WorkflowActionGuard],
})
export class AuthModule {}
