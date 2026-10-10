import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  RequireWorkflowAction,
  WorkflowActionGuard,
} from '../auth/workflow-action.guard.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import { WarehousesService } from './warehouses.service.js';

@ApiTags('warehouses')
@Controller('warehouses')
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
export class WarehousesController {
  constructor(private readonly service: WarehousesService) {}

  @Get('it')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.warehouseItView)
  findItWarehouse(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findItWarehouse(actor);
  }

  @Get('it/assets')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.warehouseItView)
  findItAssets(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findItAssets(actor);
  }
}
