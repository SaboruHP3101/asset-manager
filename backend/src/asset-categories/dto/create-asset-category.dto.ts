import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateAssetCategoryDto {
  /** Mã danh mục tài sản duy nhất. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/\S/)
  code: string;

  /** Tên hiển thị của danh mục tài sản. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/\S/)
  name: string;

  /** Mô tả tùy chọn của danh mục tài sản. */
  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['it', 'procurement'])
  managementOwner: 'it' | 'procurement';

  @IsIn(['individual_asset', 'consumable'])
  trackingMode: 'individual_asset' | 'consumable';
}
