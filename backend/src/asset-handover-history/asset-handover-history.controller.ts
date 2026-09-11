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
import { AssetHandoverHistoryService } from './asset-handover-history.service.js';
import { CreateAssetHandoverHistoryDto } from './dto/create-asset-handover-history.dto.js';
import { UpdateAssetHandoverHistoryDto } from './dto/update-asset-handover-history.dto.js';
import { AssetHandoverHistory } from './entities/asset-handover-history.entity.js';

@ApiTags('asset-handover-history')
@Controller('asset-handover-history')
export class AssetHandoverHistoryController {
  constructor(
    private readonly assetHandoverHistoryService: AssetHandoverHistoryService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: AssetHandoverHistory })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateAssetHandoverHistoryDto) {
    return this.assetHandoverHistoryService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: AssetHandoverHistory, isArray: true })
  findAll() {
    return this.assetHandoverHistoryService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: AssetHandoverHistory })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy lịch sử bàn giao tài sản',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetHandoverHistoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AssetHandoverHistory })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy lịch sử bàn giao tài sản',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetHandoverHistoryDto,
  ) {
    return this.assetHandoverHistoryService.update(id, dto);
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
  @ApiNotFoundResponse({
    description: 'Không tìm thấy lịch sử bàn giao tài sản',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetHandoverHistoryService.remove(id);
  }
}
