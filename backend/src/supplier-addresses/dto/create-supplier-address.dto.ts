import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateSupplierAddressDto {
  /** UUID của nhà cung cấp. */
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  /** Loại địa chỉ của nhà cung cấp. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  addressType: string;

  /** Nội dung địa chỉ chi tiết. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  address: string;

  /** Tỉnh hoặc thành phố. */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  provinceCity?: string;

  /** Quốc gia. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  country: string;
}
