import {
  IsIP,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateChangeHistoryDto {
  /** Loại đối tượng. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  entityType: string;

  /** UUID của đối tượng. */
  @IsUUID()
  @IsNotEmpty()
  entityId: string;

  /** Hành động. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  action: string;

  /** Dữ liệu trước khi thay đổi. */
  @IsObject()
  @IsOptional()
  oldData?: Record<string, unknown>;

  /** Dữ liệu sau khi thay đổi. */
  @IsObject()
  @IsOptional()
  newData?: Record<string, unknown>;

  /** UUID của nhân viên thực hiện. */
  @IsUUID()
  @IsNotEmpty()
  performedByEmployeeId: string;

  /** Địa chỉ IP của người thực hiện. */
  @IsIP()
  @IsOptional()
  @MaxLength(45)
  ipAddress?: string;

  /** Thông tin user agent của người thực hiện. */
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  userAgent?: string;
}
