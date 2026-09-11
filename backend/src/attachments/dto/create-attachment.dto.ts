import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateAttachmentDto {
  /** Loại đối tượng. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  entityType: string;

  /** UUID của đối tượng. */
  @IsUUID()
  @IsNotEmpty()
  entityId: string;

  /** Tên tệp. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileName: string;

  /** Địa chỉ URL của tệp. */
  @IsUrl({ require_protocol: true })
  @IsNotEmpty()
  @MaxLength(2048)
  url: string;

  /** Loại MIME của tệp. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mimeType: string;

  /** Kích thước tệp tính bằng byte. */
  @IsInt()
  @IsNotEmpty()
  size: number;

  /** UUID của nhân viên tải tệp lên. */
  @IsUUID()
  @IsNotEmpty()
  uploadedByEmployeeId: string;
}
