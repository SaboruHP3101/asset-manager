import { PartialType } from '@nestjs/swagger';
import { CreateRepairRequestDto } from './create-repair-request.dto.js';

export class UpdateRepairRequestDto extends PartialType(
  CreateRepairRequestDto,
) {}
