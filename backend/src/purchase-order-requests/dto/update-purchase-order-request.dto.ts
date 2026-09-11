import { PartialType } from '@nestjs/swagger';
import { CreatePurchaseOrderRequestDto } from './create-purchase-order-request.dto.js';

export class UpdatePurchaseOrderRequestDto extends PartialType(
  CreatePurchaseOrderRequestDto,
) {}
