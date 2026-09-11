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
import { AssetLiquidationItemsService } from './asset-liquidation-items.service.js';
import { CreateAssetLiquidationItemDto } from './dto/create-asset-liquidation-item.dto.js';
import { UpdateAssetLiquidationItemDto } from './dto/update-asset-liquidation-item.dto.js';
import { AssetLiquidationItem } from './entities/asset-liquidation-item.entity.js';

@ApiTags('asset-liquidation-items')
@Controller('asset-liquidation-items')
export class AssetLiquidationItemsController {
  constructor(
    private readonly assetLiquidationItemsService: AssetLiquidationItemsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: AssetLiquidationItem })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateAssetLiquidationItemDto) {
    return this.assetLiquidationItemsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: AssetLiquidationItem, isArray: true })
  findAll() {
    return this.assetLiquidationItemsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: AssetLiquidationItem })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy hạng mục thanh lý tài sản',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetLiquidationItemsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AssetLiquidationItem })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy hạng mục thanh lý tài sản',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetLiquidationItemDto,
  ) {
    return this.assetLiquidationItemsService.update(id, dto);
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
  @ApiNotFoundResponse({
    description: 'Không tìm thấy hạng mục thanh lý tài sản',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetLiquidationItemsService.remove(id);
  }
}
