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
import { SupplierContactsService } from './supplier-contacts.service.js';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto.js';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto.js';
import { SupplierContact } from './entities/supplier-contact.entity.js';

@ApiTags('supplier-contacts')
@Controller('supplier-contacts')
export class SupplierContactsController {
  constructor(
    private readonly supplierContactsService: SupplierContactsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: SupplierContact })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateSupplierContactDto) {
    return this.supplierContactsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: SupplierContact, isArray: true })
  findAll() {
    return this.supplierContactsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: SupplierContact })
  @ApiNotFoundResponse({ description: 'Không tìm thấy liên hệ nhà cung cấp' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplierContactsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: SupplierContact })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy liên hệ nhà cung cấp' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierContactDto,
  ) {
    return this.supplierContactsService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy liên hệ nhà cung cấp' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplierContactsService.remove(id);
  }
}
