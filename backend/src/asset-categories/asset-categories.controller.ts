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
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AssetCategoriesService } from './asset-categories.service.js';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto.js';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto.js';
import { AssetCategory } from './entities/asset-category.entity.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

@ApiTags('asset-categories')
@Controller('asset-categories')
export class AssetCategoriesController {
  constructor(
    private readonly assetCategoriesService: AssetCategoriesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ type: AssetCategory })
  @ApiConflictResponse({
    description: 'Mã danh mục đã tồn tại hoặc danh mục cha không hợp lệ',
  })
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createAssetCategoryDto: CreateAssetCategoryDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.requireIT(actor);

    return this.assetCategoriesService.create(createAssetCategoryDto);
  }

  @Get()
  @ApiOkResponse({ type: AssetCategory, isArray: true })
  findAll() {
    return this.assetCategoriesService.findAll();
  }

  @Get('purchase-options')
  @ApiOkResponse({ type: AssetCategory, isArray: true })
  findPurchaseOptions() {
    return this.assetCategoriesService.findPurchaseOptions();
  }

  @Get(':id')
  @ApiOkResponse({ type: AssetCategory })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục tài sản' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetCategoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: AssetCategory })
  @ApiConflictResponse({
    description: 'Mã danh mục đã tồn tại hoặc danh mục cha không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục tài sản' })
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
  @ApiConflictResponse({
    description: 'Danh mục có danh mục con hoặc dữ liệu tham chiếu',
  })
  @ApiOkResponse({
    schema: {
      example: { deleted: true },
      properties: { deleted: { type: 'boolean' } },
    },
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy danh mục tài sản' })
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
