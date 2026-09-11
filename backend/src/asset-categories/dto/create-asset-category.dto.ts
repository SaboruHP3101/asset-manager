import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAssetCategoryDto {
  /** Mã danh mục tài sản duy nhất. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  /** Tên hiển thị của danh mục tài sản. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /** UUID của danh mục cha, dùng cho cấu trúc danh mục phân cấp. */
  @IsUUID()
  @IsOptional()
  parentCategoryId?: string;

  /** Mô tả tùy chọn của danh mục tài sản. */
  @IsString()
  @IsOptional()
  description?: string;
}
