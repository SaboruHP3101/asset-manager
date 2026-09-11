import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAssetInventoryDto {
  /** UUID của tài sản. */
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  /** UUID của nhân viên kiểm kê. */
  @IsUUID()
  @IsNotEmpty()
  inspectedByEmployeeId: string;

  /** Ngày kiểm kê theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  inspectionDate: string;

  /** Ngày hoàn thành theo định dạng ISO 8601. */
  @IsDateString()
  @IsOptional()
  completionDate?: string;

  /** Trạng thái thực tế của tài sản. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  actualStatus: string;

  /** Ghi chú. */
  @IsString()
  @IsOptional()
  note?: string;
}
