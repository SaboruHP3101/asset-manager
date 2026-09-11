import { PartialType } from '@nestjs/swagger';
import { CreateAssetLiquidationDto } from './create-asset-liquidation.dto.js';

export class UpdateAssetLiquidationDto extends PartialType(
  CreateAssetLiquidationDto,
) {}
