import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierContactDto } from './create-supplier-contact.dto.js';

export class UpdateSupplierContactDto extends PartialType(
  CreateSupplierContactDto,
) {}
