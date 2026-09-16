import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Headers,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiConsumes,
} from '@nestjs/swagger';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { RepairRequestsService } from './repair-requests.service.js';
import { CreateRepairRequestDto } from './dto/create-repair-request.dto.js';
import { UpdateRepairRequestDto } from './dto/update-repair-request.dto.js';
import { RepairRequest } from './entities/repair-request.entity.js';
import { AuthService } from '../auth/auth.service.js';
import { CreateMyRepairRequestDto } from './dto/create-my-repair-request.dto.js';

const uploadFolder = 'uploads/repair-requests';

// Lưu tệp bằng tên ngẫu nhiên để tránh trùng tên
const repairUpload = AnyFilesInterceptor({
  storage: diskStorage({
    destination: (_request, _file, callback) => {
      mkdirSync(uploadFolder, { recursive: true });
      callback(null, uploadFolder);
    },
    filename: (_request, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { files: 5, fileSize: 20 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const mediaExtension = /\.(jpg|jpeg|png|gif|webp|heic|mp4|mov|avi|mkv)$/i;
    const allowed =
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      mediaExtension.test(file.originalname);
    callback(
      allowed ? null : new Error('Chỉ chấp nhận ảnh hoặc video.'),
      allowed,
    );
  },
});

@ApiTags('repair-requests')
@Controller('repair-requests')
export class RepairRequestsController {
  constructor(
    private readonly repairRequestsService: RepairRequestsService,
    private readonly authService: AuthService,
  ) {}

  // Tạo yêu cầu sửa chữa cho tài sản của nhân viên hiện tại
  @Post('mine')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(repairUpload)
  async createMine(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateMyRepairRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const employeeId = await this.authService.getEmployeeId(authHeader);
    return this.repairRequestsService.createMine(employeeId, dto, files ?? []);
  }

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
