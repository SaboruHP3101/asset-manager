import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateTransferRequestDto,
  TransferApprovalDto,
} from './dto/transfer-request.dto.js';
import { TransferRequestsService } from './transfer-requests.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  RequireWorkflowAction,
  WorkflowActionGuard,
} from '../auth/workflow-action.guard.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';

@ApiTags('transfer-requests')
@Controller('transfer-requests')
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
/** Điều phối API điều chuyển và áp dụng quyền riêng cho từng bước của quy trình. */
export class TransferRequestsController {
  constructor(private readonly service: TransferRequestsService) {}

  @Post()
  @RequireWorkflowAction(WORKFLOW_ACTIONS.transferCreate)
  create(
    @Body() dto: CreateTransferRequestDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.create(dto, actor);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  /** Endpoint hành động giúp API không cho phép client tự gán status tùy ý. */
  @Post(':id/approve-department')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.transferApproveDepartment)
  approveDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferApprovalDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.approveDepartment(id, dto, actor);
  }

  @Post(':id/verify')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.transferVerify)
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.verify(id, actor);
  }

  @Post(':id/confirm-handoff')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.transferConfirm)
  confirmHandoff(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.confirmHandoff(id, actor);
  }
}
