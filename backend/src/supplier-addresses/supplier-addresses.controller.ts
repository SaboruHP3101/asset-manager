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
import { SupplierAddressesService } from './supplier-addresses.service.js';
import { CreateSupplierAddressDto } from './dto/create-supplier-address.dto.js';
import { UpdateSupplierAddressDto } from './dto/update-supplier-address.dto.js';
import { SupplierAddress } from './entities/supplier-address.entity.js';

@ApiTags('supplier-addresses')
@Controller('supplier-addresses')
export class SupplierAddressesController {
  constructor(
    private readonly supplierAddressesService: SupplierAddressesService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: SupplierAddress })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateSupplierAddressDto) {
    return this.supplierAddressesService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: SupplierAddress, isArray: true })
  findAll() {
    return this.supplierAddressesService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: SupplierAddress })
  @ApiNotFoundResponse({ description: 'Không tìm thấy địa chỉ nhà cung cấp' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplierAddressesService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: SupplierAddress })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy địa chỉ nhà cung cấp' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierAddressDto,
  ) {
    return this.supplierAddressesService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy địa chỉ nhà cung cấp' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplierAddressesService.remove(id);
  }
}
