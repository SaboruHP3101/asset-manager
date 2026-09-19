import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
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
import { CreateMyRepairRequestDto } from './dto/create-my-repair-request.dto.js';
import {
  AssessRepairDto,
  AssignRepairDto,
  CompleteRepairDto,
  ConfirmRepairDto,
  RepairApprovalDto,
} from './dto/repair-workflow.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  RequireWorkflowAction,
  WorkflowActionGuard,
} from '../auth/workflow-action.guard.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';

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
@UseGuards(JwtAuthGuard, WorkflowActionGuard)
/** Quản lý vòng đời sửa chữa, bao gồm tải minh chứng và nghiệm thu của người báo. */
export class RepairRequestsController {
  constructor(private readonly repairRequestsService: RepairRequestsService) {}

  // Tạo yêu cầu sửa chữa cho tài sản của nhân viên hiện tại
  @Post('mine')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairReport)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(repairUpload)
  async createMine(
    @CurrentEmployee() actor: AuthenticatedEmployee,
    @Body() dto: CreateMyRepairRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.repairRequestsService.createMine(actor, dto, files ?? []);
  }

  @Post()
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairReport)
  @ApiCreatedResponse({ type: RepairRequest })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(
    @Body() dto: CreateRepairRequestDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.create(dto, actor);
  }

  /** Danh sách yêu cầu sửa chữa do nhân viên hiện tại tạo. */
  @Get('mine')
  findMine(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.repairRequestsService.findMine(actor.id);
  }

  /** Timeline của đúng yêu cầu được chọn trong danh sách cá nhân. */
  @Get('mine/:id/progress')
  findMyProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.findMyProgress(actor.id, id);
  }

  /** Lấy yêu cầu gần nhất và timeline của một tài sản thuộc nhân viên hiện tại. */
  @Get('mine/asset/:assetId')
  findMyLatestByAsset(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.findMyLatestByAsset(actor.id, assetId);
  }

  /** Endpoint riêng cho từng hành động để service có thể kiểm soát thứ tự trạng thái. */
  @Post(':id/assess')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairAssess)
  assess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssessRepairDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.assess(id, dto, actor);
  }

  @Post(':id/approve-department')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairApproveDepartment)
  approveDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepairApprovalDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.approveDepartment(id, dto, actor);
  }

  @Post(':id/assign')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairAssign)
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRepairDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.assign(id, dto, actor);
  }

  @Post(':id/complete')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairComplete)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteRepairDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.complete(id, dto, actor);
  }

  @Post(':id/confirm-result')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairConfirmResult)
  confirmResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRepairDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.confirmResult(id, dto, actor);
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
