import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  RequireWorkflowAction,
  WorkflowActionGuard,
} from '../auth/workflow-action.guard.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import {
  CreatePurchaseQuoteDto,
  PurchaseRequestDecisionDto,
  SavePurchaseRequestDto,
} from './dto/purchase-request.dto.js';
import { purchaseQuoteUpload } from './purchase-quote-upload.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';

@ApiTags('purchase-requests')
@Controller('purchase-requests')
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
export class PurchaseRequestsController {
  constructor(private readonly service: PurchaseRequestsService) {}

  @Post()
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseRequestCreate)
  create(
    @Body() dto: SavePurchaseRequestDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseRequestUpdate)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SavePurchaseRequestDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.update(id, dto, actor);
  }

  @Post(':id/submit')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseRequestSubmit)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.submit(id, actor);
  }

  @Get('mine')
  findMine(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findMine(actor);
  }

  @Get('queue')
  findQueue(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findQueue(actor);
  }

  @Post(':id/approve-department')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseRequestApproveDepartment)
  decideDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PurchaseRequestDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decideDepartment(id, dto, actor);
  }

  @Post(':id/quotes')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(purchaseQuoteUpload)
  addQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePurchaseQuoteDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.addQuote(id, dto, file, actor);
  }

  @Post(':id/submit-procurement')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement)
  submitProcurement(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.submitProcurement(id, actor);
  }

  @Post(':id/approve-procurement')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseRequestApproveProcurement)
  decideProcurement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PurchaseRequestDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decideProcurement(id, dto, actor);
  }

  @Post(':id/approve-it')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseRequestApproveIt)
  decideIt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PurchaseRequestDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decideIt(id, dto, actor);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.findOne(id, actor);
  }
}
