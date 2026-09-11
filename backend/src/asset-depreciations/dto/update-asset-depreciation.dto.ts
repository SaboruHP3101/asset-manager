import { PartialType } from '@nestjs/swagger';
import { CreateAssetDepreciationDto } from './create-asset-depreciation.dto.js';

export class UpdateAssetDepreciationDto extends PartialType(
  CreateAssetDepreciationDto,
) {}
