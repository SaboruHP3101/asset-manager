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
  Query,
  ForbiddenException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AssetsService } from './assets.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { Asset } from './entities/asset.entity.js';
import { AuthService } from '../auth/auth.service.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: Asset })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  create(@Body() dto: CreateAssetDto) {
    return this.assetsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: Asset, isArray: true })
  findAll(@CurrentEmployee() actor: AuthenticatedEmployee) {
    if (actor.departmentName !== 'IT') {
      throw new ForbiddenException('Chỉ phòng IT được xem danh sách tài sản.');
    }

    return this.assetsService.findAll();
  }

  // Lấy tài sản đang được giao cho nhân viên hiện tại
  @Get('mine')
  async findMine(
    @Headers('authorization') authHeader: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sort') sort?: string,
  ) {
    const employeeId = await this.authService.getEmployeeId(authHeader);

    return this.assetsService.findMine(employeeId, search, categoryId, sort);
  }

  // Chỉ lấy danh mục cha đang có tài sản thuộc nhân viên hiện tại
  @Get('mine/categories')
  async findMyParentCategories(@Headers('authorization') authHeader: string) {
    const employeeId = await this.authService.getEmployeeId(authHeader);

    return this.assetsService.findMyParentCategories(employeeId);
  }

  // Lấy chi tiết một tài sản thuộc nhân viên hiện tại
  @Get('mine/:id')
  async findMineById(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const employeeId = await this.authService.getEmployeeId(authHeader);

    return this.assetsService.findMineById(employeeId, id);
  }

  @Get(':id')
  @ApiOkResponse({ type: Asset })
  @ApiNotFoundResponse({ description: 'Không tìm thấy tài sản' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: Asset })
  @ApiConflictResponse({
    description: 'Dữ liệu đã tồn tại hoặc có tham chiếu không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy tài sản' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateAssetDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    if (actor.departmentName !== 'IT') {
      throw new ForbiddenException('Chỉ phòng IT được cập nhật tài sản.');
    }

    return this.assetsService.update(id, dto);
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
  @ApiNotFoundResponse({ description: 'Không tìm thấy tài sản' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.remove(id);
  }
}
