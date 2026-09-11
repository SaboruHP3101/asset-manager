import { PartialType } from '@nestjs/swagger';
import { CreateAssetHandoverHistoryDto } from './create-asset-handover-history.dto.js';

export class UpdateAssetHandoverHistoryDto extends PartialType(
  CreateAssetHandoverHistoryDto,
) {}
