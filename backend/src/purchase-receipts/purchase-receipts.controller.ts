import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
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
  CloseShortPurchaseOrderDto,
  InspectPurchaseReceiptUnitDto,
  RecordPurchaseReceiptDto,
} from './dto/purchase-receipt.dto.js';
import {
  purchaseInspectionUpload,
  purchaseReceiptUpload,
} from './purchase-receipt-upload.js';
import { PurchaseReceiptsService } from './purchase-receipts.service.js';

type ReceiptFiles = Partial<
  Record<'deliveryNote' | 'invoice' | 'warranty', Express.Multer.File[]>
>;

@ApiTags('purchase-receipts')
@Controller('purchase-receipts')
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
export class PurchaseReceiptsController {
  constructor(private readonly service: PurchaseReceiptsService) {}

  @Post('purchase-orders/:orderId')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseReceiptRecord)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(purchaseReceiptUpload)
  record(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RecordPurchaseReceiptDto,
    @UploadedFiles() files: ReceiptFiles,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.record(orderId, dto, files, actor);
  }

  @Get('queue')
  findInspectionQueue(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.service.findInspectionQueue(actor);
  }

  @Get('purchase-orders/:orderId/progress')
  findOrderProgress(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.findOrderProgress(orderId, actor);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.findOne(id, actor);
  }

  @Post('units/:unitId/inspection')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(purchaseInspectionUpload)
  inspectUnit(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: InspectPurchaseReceiptUnitDto,
    @UploadedFiles() files: { evidence?: Express.Multer.File[] },
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.inspectUnit(unitId, dto, files.evidence?.[0], actor);
  }

  @Post('purchase-orders/:orderId/close-short')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.purchaseReceiptCloseShort)
  closeShort(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CloseShortPurchaseOrderDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.service.closeShort(orderId, dto, actor);
  }
}
