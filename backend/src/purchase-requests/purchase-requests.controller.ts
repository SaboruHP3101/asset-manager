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
import { PurchaseRequestsService } from './purchase-requests.service.js';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto.js';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto.js';
import { PurchaseRequest } from './entities/purchase-request.entity.js';

@ApiTags('purchase-requests')
@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(
    private readonly purchaseRequestsService: PurchaseRequestsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: PurchaseRequest })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreatePurchaseRequestDto) {
    return this.purchaseRequestsService.create(dto);
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
