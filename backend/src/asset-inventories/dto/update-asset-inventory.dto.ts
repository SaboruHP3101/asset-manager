import { PartialType } from '@nestjs/swagger';
import { CreateAssetInventoryDto } from './create-asset-inventory.dto.js';

export class UpdateAssetInventoryDto extends PartialType(
  CreateAssetInventoryDto,
) {}
