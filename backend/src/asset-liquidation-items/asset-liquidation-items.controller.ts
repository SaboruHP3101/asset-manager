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
import { AssetLiquidationItemsService } from './asset-liquidation-items.service.js';
import { CreateAssetLiquidationItemDto } from './dto/create-asset-liquidation-item.dto.js';
import { UpdateAssetLiquidationItemDto } from './dto/update-asset-liquidation-item.dto.js';

@Controller('asset-liquidation-items')
export class AssetLiquidationItemsController {
  constructor(
    private readonly assetLiquidationItemsService: AssetLiquidationItemsService,
  ) {}

  @Post()
  create(@Body() dto: CreateAssetLiquidationItemDto) {
    return this.assetLiquidationItemsService.create(dto);
  }

  @Get()
  findAll() {
    return this.assetLiquidationItemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetLiquidationItemsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetLiquidationItemDto,
  ) {
    return this.assetLiquidationItemsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetLiquidationItemsService.remove(id);
  }
}
