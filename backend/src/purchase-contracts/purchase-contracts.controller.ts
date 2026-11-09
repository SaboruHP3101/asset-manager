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
import { PurchaseContractsService } from './purchase-contracts.service.js';
import { CreatePurchaseContractDto } from './dto/create-purchase-contract.dto.js';
import { UpdatePurchaseContractDto } from './dto/update-purchase-contract.dto.js';

@Controller('purchase-contracts')
export class PurchaseContractsController {
  constructor(
    private readonly purchaseContractsService: PurchaseContractsService,
  ) {}

  @Post()
  create(@Body() dto: CreatePurchaseContractDto) {
    return this.purchaseContractsService.create(dto);
  }

  @Get()
  findAll() {
    return this.purchaseContractsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseContractsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseContractDto,
  ) {
    return this.purchaseContractsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseContractsService.remove(id);
  }
}
