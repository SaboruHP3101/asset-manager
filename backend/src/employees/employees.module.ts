import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service.js';
import { EmployeesController } from './employees.controller.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, JwtAuthGuard],
  imports: [DrizzleModule],
  exports: [EmployeesService],
})
export class EmployeesModule {}
