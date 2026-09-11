import { PartialType } from '@nestjs/swagger';
import { CreatePurchaseOrderItemDto } from './create-purchase-order-item.dto.js';

export class UpdatePurchaseOrderItemDto extends PartialType(
  CreatePurchaseOrderItemDto,
) {}
