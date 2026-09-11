import { PartialType } from '@nestjs/swagger';
import { CreateChangeHistoryDto } from './create-change-history.dto.js';

export class UpdateChangeHistoryDto extends PartialType(
  CreateChangeHistoryDto,
) {}
