import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  CancelPurchaseOrderDto,
  PurchaseOrderDecisionDto,
  PurchaseOrderQueryDto,
  SavePurchaseOrderDto,
} from './dto/purchase-order.dto.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

@ApiTags('purchase-orders')
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  /** Tạo đơn mua */
  @Post()
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseOrderCreate)
  create(
    @Body() dto: SavePurchaseOrderDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.create(dto, actor);
  }

  /** Trả các đề nghị đã duyệt nhưng vẫn còn hạng mục có thể lập thành đơn mua */
  @Get('eligible-requests')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseOrderCreate)
  findEligibleRequests(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findEligibleRequests(actor);
  }

  /** Trả danh sách đơn mua đang chờ Trưởng Thu mua quyết định */
  @Get('queue')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseOrderApprove)
  findApprovalQueue(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findApprovalQueue(actor);
  }

  /** Lọc danh sách dơn mua theo đề nghị, nhà cung cấp hoặc trạng thái */
  @Get()
  findAll(
    @CurrentEmployee() actor: AuthenticatedEmployee,
    @Query() query: PurchaseOrderQueryDto,
  ) {
    return this.service.findAll(actor, query);
  }

  @Patch(':id')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseOrderCreate)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SavePurchaseOrderDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.update(id, dto, actor);
  }

  /** Gửi đơn mua nháp tới Trưởng Thu mua */
  @Post(':id/submit')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseOrderSubmit)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.submit(id, actor);
  }

  /** Duyệt phát hành hoặc từ chối đơn mua */
  @Post(':id/decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseOrderApprove)
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PurchaseOrderDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.decide(id, dto, actor);
  }

  /** Hủy đơn mua */
  @Post(':id/cancel')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseOrderCancel)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPurchaseOrderDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.cancel(id, dto, actor);
  }

  /** Lấy thông tin đơn mua bất kì với id */
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.findOne(id, actor);
  }
}
