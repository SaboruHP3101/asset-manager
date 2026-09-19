import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
/** Cung cấp số liệu Home theo nhân viên lấy từ access token. */
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('mine')
  @ApiOkResponse({
    schema: { example: { assignedAssets: 4, activeRequests: 2 } },
  })
  getMine(@CurrentEmployee() employee: AuthenticatedEmployee) {
    return this.dashboardService.getMySummary(employee.id);
  }
}
