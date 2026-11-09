import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierAddressDto } from './create-supplier-address.dto.js';

export class UpdateSupplierAddressDto extends PartialType(
  CreateSupplierAddressDto,
) {}
