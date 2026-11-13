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
import { AssetsService } from './assets.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { AuthService } from '../auth/auth.service.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateAssetDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.assertItDepartment(actor);

    return this.assetsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
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
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.findOne(id);
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  findHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.assertItDepartment(actor);

    return this.assetsService.findHistory(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateAssetDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    if (actor.departmentName !== 'IT') {
      throw new ForbiddenException('Chỉ phòng IT được cập nhật tài sản.');
    }

    return this.assetsService.update(id, dto, actor.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.assertItDepartment(actor);

    return this.assetsService.remove(id);
  }
  private assertItDepartment(actor: AuthenticatedEmployee) {
    if (actor.departmentName !== 'IT')
      throw new ForbiddenException(
        'Chỉ phòng IT được thực hiện thao tác tài sản này.',
      );
  }
}
