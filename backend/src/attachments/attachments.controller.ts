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
import { AttachmentsService } from './attachments.service.js';
import { CreateAttachmentDto } from './dto/create-attachment.dto.js';
import { UpdateAttachmentDto } from './dto/update-attachment.dto.js';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  create(@Body() dto: CreateAttachmentDto) {
    return this.attachmentsService.create(dto);
  }

  @Get()
  findAll() {
    return this.attachmentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttachmentDto,
  ) {
    return this.attachmentsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.remove(id);
  }
}
