import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PurchaseRequestsService } from './purchase-requests.service.js';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto.js';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto.js';
import { PurchaseRequest } from './entities/purchase-request.entity.js';
import {
  AllocateAssetsDto,
  ApprovalDecisionDto,
  CreateOrderDto,
  ReceiveAssetsDto,
} from './dto/purchase-workflow.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  RequireWorkflowAction,
  WorkflowActionGuard,
} from '../auth/workflow-action.guard.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';

@ApiTags('purchase-requests')
@Controller('purchase-requests')
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
/** Cung cấp API mua sắm và bắt buộc JWT trước khi kiểm tra từng quyền hành động. */
export class PurchaseRequestsController {
  constructor(
    private readonly purchaseRequestsService: PurchaseRequestsService,
  ) {}

  @Post()
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseSubmit)
  @ApiCreatedResponse({ type: PurchaseRequest })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(
    @Body() dto: CreatePurchaseRequestDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.purchaseRequestsService.create(dto, actor);
  }

  /** Các endpoint hành động thể hiện rõ ý định thay vì cho sửa status tùy ý. */
  @Post(':id/submit')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseSubmit)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.purchaseRequestsService.submit(id, actor);
  }

  @Post(':id/approve-department')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseApproveDepartment)
  approveDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.purchaseRequestsService.approveDepartment(id, dto, actor);
  }

  @Post(':id/approve-finance')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseApproveFinance)
  approveFinance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.purchaseRequestsService.approveFinance(id, dto, actor);
  }

  @Post(':id/approve-executive')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseApproveExecutive)
  approveExecutive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.purchaseRequestsService.approveExecutive(id, dto, actor);
  }

  @Post(':id/order')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseCreateOrder)
  createOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOrderDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.purchaseRequestsService.createOrder(id, dto, actor);
  }

  @Post(':id/receive-assets')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseReceiveAssets)
  receiveAssets(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveAssetsDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.purchaseRequestsService.receiveAssets(id, dto, actor);
  }

  @Post(':id/allocate-assets')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseAllocateAssets)
  allocateAssets(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateAssetsDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.purchaseRequestsService.allocateAssets(id, dto, actor);
  }

  @Get()
  @ApiOkResponse({ type: PurchaseRequest, isArray: true })
  findAll() {
    return this.purchaseRequestsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: PurchaseRequest })
  @ApiNotFoundResponse({ description: 'Không tìm thấy yêu cầu mua sắm' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseRequestsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PurchaseRequest })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy yêu cầu mua sắm' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseRequestDto,
  ) {
    return this.purchaseRequestsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({
    schema: {
      example: { deleted: true },
      properties: { deleted: { type: 'boolean' } },
    },
  })
  @ApiConflictResponse({
    description: 'Không thể xóa vì dữ liệu đang được tham chiếu',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy yêu cầu mua sắm' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseRequestsService.remove(id);
  }
}
