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
import { AssetLiquidationsService } from './asset-liquidations.service.js';
import { CreateAssetLiquidationDto } from './dto/create-asset-liquidation.dto.js';
import { UpdateAssetLiquidationDto } from './dto/update-asset-liquidation.dto.js';

@Controller('asset-liquidations')
export class AssetLiquidationsController {
  constructor(
    private readonly assetLiquidationsService: AssetLiquidationsService,
  ) {}

  @Post()
  create(@Body() dto: CreateAssetLiquidationDto) {
    return this.assetLiquidationsService.create(dto);
  }

  @Get()
  findAll() {
    return this.assetLiquidationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetLiquidationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetLiquidationDto,
  ) {
    return this.assetLiquidationsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetLiquidationsService.remove(id);
  }
}
