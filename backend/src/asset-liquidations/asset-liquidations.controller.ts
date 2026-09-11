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
import { AssetLiquidationsService } from './asset-liquidations.service.js';
import { CreateAssetLiquidationDto } from './dto/create-asset-liquidation.dto.js';
import { UpdateAssetLiquidationDto } from './dto/update-asset-liquidation.dto.js';
import { AssetLiquidation } from './entities/asset-liquidation.entity.js';

@ApiTags('asset-liquidations')
@Controller('asset-liquidations')
export class AssetLiquidationsController {
  constructor(
    private readonly assetLiquidationsService: AssetLiquidationsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: AssetLiquidation })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateAssetLiquidationDto) {
    return this.assetLiquidationsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: AssetLiquidation, isArray: true })
  findAll() {
    return this.assetLiquidationsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: AssetLiquidation })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy đề nghị thanh lý tài sản',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetLiquidationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AssetLiquidation })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy đề nghị thanh lý tài sản',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetLiquidationDto,
  ) {
    return this.assetLiquidationsService.update(id, dto);
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
    description: 'Không tìm thấy đề nghị thanh lý tài sản',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetLiquidationsService.remove(id);
  }
}
