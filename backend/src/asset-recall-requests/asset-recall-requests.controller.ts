import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { AssetRecallRequestsService } from './asset-recall-requests.service.js';
import {
  CreateAssetRecallRequestDto,
  ItRecallDecisionDto,
  RecallDecisionDto,
  RecallHandoverDecisionDto,
  UpdateAssetRecallRequestDto,
} from './dto/asset-recall-request.dto.js';

@ApiTags('asset-recall-requests')
@Controller('asset-recall-requests')
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
export class AssetRecallRequestsController {
  constructor(private readonly service: AssetRecallRequestsService) {}

  @Post()
  @RequireWorkflowAction(WORKFLOW_ACTIONS.assetRecallCreate)
  create(
    @Body() dto: CreateAssetRecallRequestDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.create(dto, actor);
  }

  @Get('mine')
  findMine(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findMine(actor);
  }

  @Get('queue')
  findQueue(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findQueue(actor);
  }

  @Get('exchange-candidates')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.assetRecallApproveIt)
  findExchangeCandidates(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findExchangeCandidates(actor);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.findOne(id, actor);
  }

  @Patch(':id')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.assetRecallUpdate)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetRecallRequestDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.update(id, dto, actor);
  }

  @Post(':id/submit')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.assetRecallSubmit)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.submit(id, actor);
  }

  @Post(':id/resubmit')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.assetRecallSubmit)
  resubmit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.submit(id, actor);
  }

  @Post(':id/department-decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.assetRecallApproveDepartment)
  decideDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecallDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decideDepartment(id, dto, actor);
  }

  @Post(':id/it-decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.assetRecallApproveIt)
  decideIt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ItRecallDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decideIt(id, dto, actor);
  }

  @Post(':id/handover-decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.assetRecallConfirmHandover)
  decideHandover(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecallHandoverDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decideHandover(id, dto, actor);
  }
}
