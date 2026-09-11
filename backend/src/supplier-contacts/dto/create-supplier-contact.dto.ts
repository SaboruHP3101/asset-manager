import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateSupplierContactDto {
  /** UUID của nhà cung cấp. */
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  /** Họ tên người liên hệ. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  /** Chức vụ của người liên hệ. */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  position?: string;

  /** Địa chỉ email của người liên hệ. */
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  /** Số điện thoại của người liên hệ. */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phoneNumber?: string;

  /** Cho biết đây có phải liên hệ chính hay không. */
  @IsBoolean()
  @IsOptional()
  isPrimaryContact?: boolean;
}
