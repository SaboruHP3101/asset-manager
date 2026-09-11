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
import { RepairRequestsService } from './repair-requests.service.js';
import { CreateRepairRequestDto } from './dto/create-repair-request.dto.js';
import { UpdateRepairRequestDto } from './dto/update-repair-request.dto.js';
import { RepairRequest } from './entities/repair-request.entity.js';

@ApiTags('repair-requests')
@Controller('repair-requests')
export class RepairRequestsController {
  constructor(private readonly repairRequestsService: RepairRequestsService) {}

  @Post()
  @ApiCreatedResponse({ type: RepairRequest })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateRepairRequestDto) {
    return this.repairRequestsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: RepairRequest, isArray: true })
  findAll() {
    return this.repairRequestsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: RepairRequest })
  @ApiNotFoundResponse({ description: 'Không tìm thấy yêu cầu sửa chữa' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.repairRequestsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: RepairRequest })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy yêu cầu sửa chữa' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRepairRequestDto,
  ) {
    return this.repairRequestsService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy yêu cầu sửa chữa' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.repairRequestsService.remove(id);
  }
}
