import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service.js';
import { EmployeesController } from './employees.controller.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
  imports: [DrizzleModule],
})
export class EmployeesModule {}
