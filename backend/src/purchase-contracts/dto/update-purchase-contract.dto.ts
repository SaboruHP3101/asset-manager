import { PartialType } from '@nestjs/mapped-types';
import { CreatePurchaseContractDto } from './create-purchase-contract.dto.js';

export class UpdatePurchaseContractDto extends PartialType(
  CreatePurchaseContractDto,
) {}
