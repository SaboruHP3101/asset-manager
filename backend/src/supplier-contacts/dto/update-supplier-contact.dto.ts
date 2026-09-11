import { PartialType } from '@nestjs/swagger';
import { CreateSupplierContactDto } from './create-supplier-contact.dto.js';

export class UpdateSupplierContactDto extends PartialType(
  CreateSupplierContactDto,
) {}
