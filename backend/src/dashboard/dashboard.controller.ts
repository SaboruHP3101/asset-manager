import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { DashboardService } from './dashboard.service.js';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
/** Cung cấp số liệu Home theo nhân viên lấy từ access token. */
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('mine')
  getMine(@CurrentEmployee() employee: AuthenticatedEmployee) {
    return this.dashboardService.getMySummary(employee);
  }
}
