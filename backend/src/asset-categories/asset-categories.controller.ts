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
import { AssetCategoriesService } from './asset-categories.service.js';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto.js';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto.js';
import { AssetCategory } from './entities/asset-category.entity.js';

@ApiTags('asset-categories')
@Controller('asset-categories')
export class AssetCategoriesController {
  constructor(
    private readonly assetCategoriesService: AssetCategoriesService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: AssetCategory })
  @ApiConflictResponse({
    description: 'Mã danh mục đã tồn tại hoặc danh mục cha không hợp lệ',
  })
  create(@Body() createAssetCategoryDto: CreateAssetCategoryDto) {
    return this.assetCategoriesService.create(createAssetCategoryDto);
  }

  @Get()
  @ApiOkResponse({ type: AssetCategory, isArray: true })
  findAll() {
    return this.assetCategoriesService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: AssetCategory })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục tài sản' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetCategoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AssetCategory })
  @ApiConflictResponse({
    description: 'Mã danh mục đã tồn tại hoặc danh mục cha không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục tài sản' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAssetCategoryDto: UpdateAssetCategoryDto,
  ) {
    return this.assetCategoriesService.update(id, updateAssetCategoryDto);
  }

  @Delete(':id')
  @ApiOkResponse({
    schema: {
      example: { deleted: true },
      properties: { deleted: { type: 'boolean' } },
    },
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục tài sản' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetCategoriesService.remove(id);
  }
}
