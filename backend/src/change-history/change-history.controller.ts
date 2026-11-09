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
import { ChangeHistoryService } from './change-history.service.js';
import { CreateChangeHistoryDto } from './dto/create-change-history.dto.js';
import { UpdateChangeHistoryDto } from './dto/update-change-history.dto.js';

@Controller('change-history')
export class ChangeHistoryController {
  constructor(private readonly changeHistoryService: ChangeHistoryService) {}

  @Post()
  create(@Body() dto: CreateChangeHistoryDto) {
    return this.changeHistoryService.create(dto);
  }

  @Get()
  findAll() {
    return this.changeHistoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.changeHistoryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChangeHistoryDto,
  ) {
    return this.changeHistoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.changeHistoryService.remove(id);
  }
}
