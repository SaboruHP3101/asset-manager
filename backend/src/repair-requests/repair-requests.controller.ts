import {
  Body,
  Controller,
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
  ApiTags,
  ApiConsumes,
} from '@nestjs/swagger';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { RepairRequestsService } from './repair-requests.service.js';
import {
  CreateMyRepairRequestDto,
  UpdateMyRepairRequestDto,
} from './dto/create-my-repair-request.dto.js';
import {
  AssignRepairDto,
  CompleteRepairDto,
  ConfirmRepairDto,
  RepairDecisionDto,
  RepairHandoverDecisionDto,
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

  /** Danh sách yêu cầu sửa chữa do nhân viên hiện tại tạo. */
  @Get('mine')
  findMine(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.repairRequestsService.findMine(actor.id);
  }

  @Get('queue')
  findQueue(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.repairRequestsService.findQueue(actor);
  }

  @Get('it-assignees')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairAssign)
  findItAssignees(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.repairRequestsService.findItAssignees(actor);
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
    return this.repairRequestsService.findMyLatestByAsset(actor, assetId);
  }

  @Patch(':id')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairUpdate)
  updateMine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMyRepairRequestDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.updateMine(id, dto, actor);
  }

  @Post(':id/submit')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairSubmit)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.submit(id, actor);
  }

  @Post(':id/resubmit')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairSubmit)
  resubmit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.submit(id, actor);
  }

  @Post(':id/department-decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairApproveDepartment)
  decideDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepairDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.decideDepartment(id, dto, actor);
  }

  @Post(':id/it-decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairApproveIt)
  decideIt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepairDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.decideIt(id, dto, actor);
  }

  @Post(':id/handover-decision')
  @RequireWorkflowAction(WORKFLOW_ACTIONS.repairConfirmHandover)
  decideHandover(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepairHandoverDecisionDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.decideHandover(id, dto, actor);
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

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.repairRequestsService.findOneForActor(id, actor);
  }
}
