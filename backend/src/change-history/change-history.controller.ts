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
import { ChangeHistoryService } from './change-history.service.js';
import { CreateChangeHistoryDto } from './dto/create-change-history.dto.js';
import { UpdateChangeHistoryDto } from './dto/update-change-history.dto.js';
import { ChangeHistory } from './entities/change-history.entity.js';

@ApiTags('change-history')
@Controller('change-history')
export class ChangeHistoryController {
  constructor(private readonly changeHistoryService: ChangeHistoryService) {}

  @Post()
  @ApiCreatedResponse({ type: ChangeHistory })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateChangeHistoryDto) {
    return this.changeHistoryService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: ChangeHistory, isArray: true })
  findAll() {
    return this.changeHistoryService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: ChangeHistory })
  @ApiNotFoundResponse({ description: 'Không tìm thấy lịch sử thay đổi' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.changeHistoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ChangeHistory })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy lịch sử thay đổi' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChangeHistoryDto,
  ) {
    return this.changeHistoryService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy lịch sử thay đổi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.changeHistoryService.remove(id);
  }
}
