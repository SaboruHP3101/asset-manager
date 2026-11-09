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
import { SupplierAddressesService } from './supplier-addresses.service.js';
import { CreateSupplierAddressDto } from './dto/create-supplier-address.dto.js';
import { UpdateSupplierAddressDto } from './dto/update-supplier-address.dto.js';

@Controller('supplier-addresses')
export class SupplierAddressesController {
  constructor(
    private readonly supplierAddressesService: SupplierAddressesService,
  ) {}

  @Post()
  create(@Body() dto: CreateSupplierAddressDto) {
    return this.supplierAddressesService.create(dto);
  }

  @Get()
  findAll() {
    return this.supplierAddressesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplierAddressesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierAddressDto,
  ) {
    return this.supplierAddressesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplierAddressesService.remove(id);
  }
}
