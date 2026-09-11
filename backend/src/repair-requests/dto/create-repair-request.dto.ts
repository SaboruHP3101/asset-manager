import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateRepairRequestDto {
  /** UUID của tài sản. */
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  /** UUID của nhân viên báo hỏng. */
  @IsUUID()
  @IsNotEmpty()
  reporterId: string;

  /** Ngày báo hỏng theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  reportDate: string;

  /** Mô tả sự cố. */
  @IsString()
  @IsNotEmpty()
  issueDescription: string;

  /** Trạng thái. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  status: string;

  /** Chi phí sửa chữa dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsOptional()
  repairCost?: string;
}
