import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetInventoryDto } from './create-asset-inventory.dto.js';

export class UpdateAssetInventoryDto extends PartialType(
  CreateAssetInventoryDto,
) {}
