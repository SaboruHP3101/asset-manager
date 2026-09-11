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
import { PurchaseContractsService } from './purchase-contracts.service.js';
import { CreatePurchaseContractDto } from './dto/create-purchase-contract.dto.js';
import { UpdatePurchaseContractDto } from './dto/update-purchase-contract.dto.js';
import { PurchaseContract } from './entities/purchase-contract.entity.js';

@ApiTags('purchase-contracts')
@Controller('purchase-contracts')
export class PurchaseContractsController {
  constructor(
    private readonly purchaseContractsService: PurchaseContractsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: PurchaseContract })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreatePurchaseContractDto) {
    return this.purchaseContractsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: PurchaseContract, isArray: true })
  findAll() {
    return this.purchaseContractsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: PurchaseContract })
  @ApiNotFoundResponse({ description: 'Không tìm thấy hợp đồng mua sắm' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseContractsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PurchaseContract })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy hợp đồng mua sắm' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseContractDto,
  ) {
    return this.purchaseContractsService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy hợp đồng mua sắm' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseContractsService.remove(id);
  }
}
