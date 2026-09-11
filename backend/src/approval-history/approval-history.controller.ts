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
import { ApprovalHistoryService } from './approval-history.service.js';
import { CreateApprovalHistoryDto } from './dto/create-approval-history.dto.js';
import { UpdateApprovalHistoryDto } from './dto/update-approval-history.dto.js';
import { ApprovalHistory } from './entities/approval-history.entity.js';

@ApiTags('approval-history')
@Controller('approval-history')
export class ApprovalHistoryController {
  constructor(
    private readonly approvalHistoryService: ApprovalHistoryService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: ApprovalHistory })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateApprovalHistoryDto) {
    return this.approvalHistoryService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: ApprovalHistory, isArray: true })
  findAll() {
    return this.approvalHistoryService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: ApprovalHistory })
  @ApiNotFoundResponse({ description: 'Không tìm thấy lịch sử phê duyệt' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvalHistoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ApprovalHistory })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy lịch sử phê duyệt' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApprovalHistoryDto,
  ) {
    return this.approvalHistoryService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy lịch sử phê duyệt' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvalHistoryService.remove(id);
  }
}
