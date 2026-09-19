import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateRepairRequestDto } from './create-repair-request.dto.js';

export class UpdateRepairRequestDto extends PartialType(
  OmitType(CreateRepairRequestDto, ['status'] as const),
) {}
