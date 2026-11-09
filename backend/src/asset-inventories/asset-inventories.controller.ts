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
import { AssetInventoriesService } from './asset-inventories.service.js';
import { CreateAssetInventoryDto } from './dto/create-asset-inventory.dto.js';
import { UpdateAssetInventoryDto } from './dto/update-asset-inventory.dto.js';

@Controller('asset-inventories')
export class AssetInventoriesController {
  constructor(
    private readonly assetInventoriesService: AssetInventoriesService,
  ) {}

  @Post()
  create(@Body() dto: CreateAssetInventoryDto) {
    return this.assetInventoriesService.create(dto);
  }

  @Get()
  findAll() {
    return this.assetInventoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetInventoriesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetInventoryDto,
  ) {
    return this.assetInventoriesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetInventoriesService.remove(id);
  }
}
