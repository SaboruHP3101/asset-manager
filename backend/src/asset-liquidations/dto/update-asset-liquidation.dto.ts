import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetLiquidationDto } from './create-asset-liquidation.dto.js';

export class UpdateAssetLiquidationDto extends PartialType(
  CreateAssetLiquidationDto,
) {}
