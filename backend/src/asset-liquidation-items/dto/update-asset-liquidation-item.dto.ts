import { PartialType } from '@nestjs/swagger';
import { CreateAssetLiquidationItemDto } from './create-asset-liquidation-item.dto.js';

export class UpdateAssetLiquidationItemDto extends PartialType(
  CreateAssetLiquidationItemDto,
) {}
