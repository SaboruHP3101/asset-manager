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
import { AssetInventoriesService } from './asset-inventories.service.js';
import { CreateAssetInventoryDto } from './dto/create-asset-inventory.dto.js';
import { UpdateAssetInventoryDto } from './dto/update-asset-inventory.dto.js';
import { AssetInventory } from './entities/asset-inventory.entity.js';

@ApiTags('asset-inventories')
@Controller('asset-inventories')
export class AssetInventoriesController {
  constructor(
    private readonly assetInventoriesService: AssetInventoriesService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: AssetInventory })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateAssetInventoryDto) {
    return this.assetInventoriesService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: AssetInventory, isArray: true })
  findAll() {
    return this.assetInventoriesService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: AssetInventory })
  @ApiNotFoundResponse({ description: 'Không tìm thấy kiểm kê tài sản' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetInventoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AssetInventory })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy kiểm kê tài sản' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetInventoryDto,
  ) {
    return this.assetInventoriesService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy kiểm kê tài sản' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetInventoriesService.remove(id);
  }
}
