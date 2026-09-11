import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateSupplierDto {
  /** Mã nhà cung cấp duy nhất. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  supplierCode: string;

  /** Tên pháp lý của nhà cung cấp. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  legalName: string;

  /** Tên thương mại của nhà cung cấp. */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  tradeName?: string;

  /** Mã số thuế duy nhất của nhà cung cấp. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  taxCode: string;

  /** Địa chỉ website của nhà cung cấp. */
  @IsUrl({ require_protocol: true })
  @IsOptional()
  @MaxLength(2048)
  website?: string;

  /** Trạng thái. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  status: string;
}
