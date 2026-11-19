import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  RequireWorkflowAction,
  WorkflowActionGuard,
} from '../auth/workflow-action.guard.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { AssetDepreciationsService } from './asset-depreciations.service.js';
import {
  DepreciationDecisionDto,
  DepreciationProfileDto,
  DepreciationSettingsDto,
} from './dto/depreciation-workflow.dto.js';

@Controller('asset-depreciations')
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
export class AssetDepreciationsController {
  constructor(private readonly service: AssetDepreciationsService) {}

  @Get('settings')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationView)
  getSettings(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.getSettings(actor);
  }

  @Post('settings')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationPrepare)
  initialize(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: DepreciationSettingsDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.initialize(dto, actor);
  }

  @Get('assets')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationView)
  listAssets(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.listAssets(actor);
  }

  @Put('assets/:id/configuration')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationPrepare)
  configureAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: DepreciationProfileDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.configureAsset(id, dto, actor);
  }

  @Get('periods')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationView)
  findAll(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findAll(actor);
  }

  @Get('periods/:id')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationView)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.findOne(id, actor);
  }

  @Post('periods/generate')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationView)
  generateDuePeriods(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findAll(actor);
  }

  @Post('periods/:id/recalculate')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationPrepare)
  recalculate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.recalculate(id, actor);
  }

  @Post('periods/:id/submit')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationPrepare)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.submit(id, actor);
  }

  @Post('periods/:id/decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.depreciationApprove)
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: DepreciationDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decide(id, dto, actor);
  }
}
