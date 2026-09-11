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
import { AssetDepreciationsService } from './asset-depreciations.service.js';
import { CreateAssetDepreciationDto } from './dto/create-asset-depreciation.dto.js';
import { UpdateAssetDepreciationDto } from './dto/update-asset-depreciation.dto.js';
import { AssetDepreciation } from './entities/asset-depreciation.entity.js';

@ApiTags('asset-depreciations')
@Controller('asset-depreciations')
export class AssetDepreciationsController {
  constructor(
    private readonly assetDepreciationsService: AssetDepreciationsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: AssetDepreciation })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateAssetDepreciationDto) {
    return this.assetDepreciationsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: AssetDepreciation, isArray: true })
  findAll() {
    return this.assetDepreciationsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: AssetDepreciation })
  @ApiNotFoundResponse({ description: 'Không tìm thấy khấu hao tài sản' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetDepreciationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AssetDepreciation })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy khấu hao tài sản' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDepreciationDto,
  ) {
    return this.assetDepreciationsService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy khấu hao tài sản' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetDepreciationsService.remove(id);
  }
}
