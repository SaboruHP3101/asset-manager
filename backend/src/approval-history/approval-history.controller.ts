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
import { ApprovalHistoryService } from './approval-history.service.js';
import { CreateApprovalHistoryDto } from './dto/create-approval-history.dto.js';
import { UpdateApprovalHistoryDto } from './dto/update-approval-history.dto.js';

@Controller('approval-history')
export class ApprovalHistoryController {
  constructor(
    private readonly approvalHistoryService: ApprovalHistoryService,
  ) {}

  @Post()
  create(@Body() dto: CreateApprovalHistoryDto) {
    return this.approvalHistoryService.create(dto);
  }

  @Get()
  findAll() {
    return this.approvalHistoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvalHistoryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApprovalHistoryDto,
  ) {
    return this.approvalHistoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvalHistoryService.remove(id);
  }
}
