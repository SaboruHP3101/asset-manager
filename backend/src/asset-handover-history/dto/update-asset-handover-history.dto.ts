import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetHandoverHistoryDto } from './create-asset-handover-history.dto.js';

export class UpdateAssetHandoverHistoryDto extends PartialType(
  CreateAssetHandoverHistoryDto,
) {}
