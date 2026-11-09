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
import { AssetHandoverHistoryService } from './asset-handover-history.service.js';
import { CreateAssetHandoverHistoryDto } from './dto/create-asset-handover-history.dto.js';
import { UpdateAssetHandoverHistoryDto } from './dto/update-asset-handover-history.dto.js';

@Controller('asset-handover-history')
export class AssetHandoverHistoryController {
  constructor(
    private readonly assetHandoverHistoryService: AssetHandoverHistoryService,
  ) {}

  @Post()
  create(@Body() dto: CreateAssetHandoverHistoryDto) {
    return this.assetHandoverHistoryService.create(dto);
  }

  @Get()
  findAll() {
    return this.assetHandoverHistoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetHandoverHistoryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetHandoverHistoryDto,
  ) {
    return this.assetHandoverHistoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetHandoverHistoryService.remove(id);
  }
}
