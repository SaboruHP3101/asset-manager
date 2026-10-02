import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  RequireWorkflowAction,
  WorkflowActionGuard,
} from '../auth/workflow-action.guard.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import { AssetAllocationsService } from './asset-allocations.service.js';
import {
  AssetAllocationDecisionDto,
  CreateAssetAllocationDto,
} from './dto/asset-allocation.dto.js';

@ApiTags('asset-allocations')
@Controller('asset-allocations')
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
export class AssetAllocationsController {
  constructor(private readonly service: AssetAllocationsService) {}

  @Get('queue')
  findQueue(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findQueue(actor);
  }

  @Get('recipients')
  findRecipients(
    @Query('departmentId', ParseUUIDPipe) departmentId: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.findRecipients(departmentId, actor);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.findOne(id, actor);
  }

  @Post()
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseAllocationCreateInitial)
  createInitial(
    @Body() dto: CreateAssetAllocationDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.create(dto, actor, false);
  }

  @Post('reallocate')
  reallocate(
    @Body() dto: CreateAssetAllocationDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.create(dto, actor, true);
  }

  @Post(':id/department-decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseAllocationConfirmDepartment)
  decideDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssetAllocationDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decide(id, dto, actor, 'department');
  }

  @Post(':id/recipient-decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseAllocationConfirmRecipient)
  decideRecipient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssetAllocationDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decide(id, dto, actor, 'recipient');
  }
}
