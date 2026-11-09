import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  ForbiddenException,
  UseGuards,
  ValidationPipe,
  Query,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { AssetCategoriesService } from './asset-categories.service.js';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto.js';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

@Controller('asset-categories')
export class AssetCategoriesController {
  constructor(
    private readonly assetCategoriesService: AssetCategoriesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createAssetCategoryDto: CreateAssetCategoryDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.requireIT(actor);

    return this.assetCategoriesService.create(createAssetCategoryDto);
  }

  @Get()
  findAll() {
    return this.assetCategoriesService.findAll();
  }

  @Get('purchase-options')
  findPurchaseOptions() {
    return this.assetCategoriesService.findPurchaseOptions();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetCategoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateAssetCategoryDto: UpdateAssetCategoryDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.requireIT(actor);

    return this.assetCategoriesService.update(id, updateAssetCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
    @Query('force', new DefaultValuePipe(false), ParseBoolPipe) force = false,
  ) {
    this.requireIT(actor);

    return this.assetCategoriesService.remove(id, force);
  }

  private requireIT(actor: AuthenticatedEmployee) {
    if (actor.departmentName !== 'IT') {
      throw new ForbiddenException(
        'Chỉ phòng IT được quản lý danh mục tài sản.',
      );
    }
  }
}
