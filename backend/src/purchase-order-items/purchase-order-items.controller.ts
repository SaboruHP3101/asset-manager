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
import { PurchaseOrderItemsService } from './purchase-order-items.service.js';
import { CreatePurchaseOrderItemDto } from './dto/create-purchase-order-item.dto.js';
import { UpdatePurchaseOrderItemDto } from './dto/update-purchase-order-item.dto.js';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity.js';

@ApiTags('purchase-order-items')
@Controller('purchase-order-items')
export class PurchaseOrderItemsController {
  constructor(
    private readonly purchaseOrderItemsService: PurchaseOrderItemsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: PurchaseOrderItem })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreatePurchaseOrderItemDto) {
    return this.purchaseOrderItemsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: PurchaseOrderItem, isArray: true })
  findAll() {
    return this.purchaseOrderItemsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: PurchaseOrderItem })
  @ApiNotFoundResponse({ description: 'Không tìm thấy hạng mục đơn đặt hàng' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrderItemsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PurchaseOrderItem })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy hạng mục đơn đặt hàng' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderItemDto,
  ) {
    return this.purchaseOrderItemsService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy hạng mục đơn đặt hàng' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrderItemsService.remove(id);
  }
}
