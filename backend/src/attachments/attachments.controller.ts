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
import { AttachmentsService } from './attachments.service.js';
import { CreateAttachmentDto } from './dto/create-attachment.dto.js';
import { UpdateAttachmentDto } from './dto/update-attachment.dto.js';
import { Attachment } from './entities/attachment.entity.js';

@ApiTags('attachments')
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @ApiCreatedResponse({ type: Attachment })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateAttachmentDto) {
    return this.attachmentsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: Attachment, isArray: true })
  findAll() {
    return this.attachmentsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: Attachment })
  @ApiNotFoundResponse({ description: 'Không tìm thấy tệp đính kèm' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: Attachment })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy tệp đính kèm' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttachmentDto,
  ) {
    return this.attachmentsService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy tệp đính kèm' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.remove(id);
  }
}
