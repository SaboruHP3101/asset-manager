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
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto.js';
import { PurchaseOrder } from './entities/purchase-order.entity.js';

@ApiTags('purchase-orders')
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @ApiCreatedResponse({ type: PurchaseOrder })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: PurchaseOrder, isArray: true })
  findAll() {
    return this.purchaseOrdersService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: PurchaseOrder })
  @ApiNotFoundResponse({ description: 'Không tìm thấy đơn đặt hàng' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PurchaseOrder })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy đơn đặt hàng' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy đơn đặt hàng' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.remove(id);
  }
}
