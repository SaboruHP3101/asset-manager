import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PurchaseOrderRequestsService } from './purchase-order-requests.service.js';
import { CreatePurchaseOrderRequestDto } from './dto/create-purchase-order-request.dto.js';
import { UpdatePurchaseOrderRequestDto } from './dto/update-purchase-order-request.dto.js';
import { PurchaseOrderRequest } from './entities/purchase-order-request.entity.js';

@ApiTags('purchase-order-requests')
@Controller('purchase-order-requests')
export class PurchaseOrderRequestsController {
  constructor(
    private readonly purchaseOrderRequestsService: PurchaseOrderRequestsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: PurchaseOrderRequest })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreatePurchaseOrderRequestDto) {
    return this.purchaseOrderRequestsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: PurchaseOrderRequest, isArray: true })
  findAll() {
    return this.purchaseOrderRequestsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: PurchaseOrderRequest })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy liên kết đơn đặt hàng và yêu cầu mua sắm',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrderRequestsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PurchaseOrderRequest })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy liên kết đơn đặt hàng và yêu cầu mua sắm',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderRequestDto,
  ) {
    return this.purchaseOrderRequestsService.update(id, dto);
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
  @ApiNotFoundResponse({
    description: 'Không tìm thấy liên kết đơn đặt hàng và yêu cầu mua sắm',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrderRequestsService.remove(id);
  }
}
