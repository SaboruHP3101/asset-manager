import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAssetLiquidationDto {
  /** UUID của nhân viên đề xuất. */
  @IsUUID()
  @IsNotEmpty()
  proposedByEmployeeId: string;

  /** Ngày đề xuất theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  proposedDate: string;

  /** Ngày phê duyệt theo định dạng ISO 8601. */
  @IsDateString()
  @IsOptional()
  approvedDate?: string;

  /** Ngày thanh lý theo định dạng ISO 8601. */
  @IsDateString()
  @IsOptional()
  liquidationDate?: string;

  /** Trạng thái. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  status: string;

  /** Lý do. */
  @IsString()
  @IsNotEmpty()
  reason: string;
}
