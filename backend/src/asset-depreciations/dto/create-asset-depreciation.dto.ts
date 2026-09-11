import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAssetDepreciationDto {
  /** UUID của tài sản. */
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  /** Ngày bắt đầu theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  fromDate: string;

  /** Ngày kết thúc theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  toDate: string;

  /** Giá trị đầu kỳ dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsNotEmpty()
  openingValue: string;

  /** Giá trị khấu hao dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsNotEmpty()
  depreciationAmount: string;

  /** Giá trị còn lại dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsNotEmpty()
  remainingValue: string;

  /** Phương pháp khấu hao. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  depreciationMethod: string;
}
