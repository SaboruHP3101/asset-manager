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
import { SupplierContactsService } from './supplier-contacts.service.js';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto.js';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto.js';

@Controller('supplier-contacts')
export class SupplierContactsController {
  constructor(
    private readonly supplierContactsService: SupplierContactsService,
  ) {}

  @Post()
  create(@Body() dto: CreateSupplierContactDto) {
    return this.supplierContactsService.create(dto);
  }

  @Get()
  findAll() {
    return this.supplierContactsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplierContactsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierContactDto,
  ) {
    return this.supplierContactsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplierContactsService.remove(id);
  }
}
