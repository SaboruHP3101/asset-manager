import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetLiquidationItemDto } from './create-asset-liquidation-item.dto.js';

export class UpdateAssetLiquidationItemDto extends PartialType(
  CreateAssetLiquidationItemDto,
) {}
