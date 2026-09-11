import { PartialType } from '@nestjs/swagger';
import { CreateAssetCategoryDto } from './create-asset-category.dto.js';

export class UpdateAssetCategoryDto extends PartialType(
  CreateAssetCategoryDto,
) {}
