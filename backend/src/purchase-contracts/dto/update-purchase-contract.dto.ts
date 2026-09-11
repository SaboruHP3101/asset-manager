import { PartialType } from '@nestjs/swagger';
import { CreatePurchaseContractDto } from './create-purchase-contract.dto.js';

export class UpdatePurchaseContractDto extends PartialType(
  CreatePurchaseContractDto,
) {}
