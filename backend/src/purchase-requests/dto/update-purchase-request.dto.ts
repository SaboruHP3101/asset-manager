import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePurchaseRequestDto } from './create-purchase-request.dto.js';

export class UpdatePurchaseRequestDto extends PartialType(
  OmitType(CreatePurchaseRequestDto, ['status'] as const),
) {}
