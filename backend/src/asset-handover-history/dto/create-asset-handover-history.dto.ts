import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAssetHandoverHistoryDto {
  /** UUID của tài sản. */
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  /** Loại bàn giao tài sản. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  handoverType: string;

  /** UUID của nhân viên bàn giao. */
  @IsUUID()
  @IsOptional()
  handoverFromEmployeeId?: string;

  /** UUID của nhân viên nhận bàn giao. */
  @IsUUID()
  @IsOptional()
  receivedByEmployeeId?: string;

  /** UUID của phòng ban bàn giao. */
  @IsUUID()
  @IsOptional()
  handoverFromDepartmentId?: string;

  /** UUID của phòng ban nhận bàn giao. */
  @IsUUID()
  @IsOptional()
  receivedByDepartmentId?: string;

  /** Ngày bàn giao theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  handoverDate: string;

  /** Trạng thái. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  status: string;

  /** Ghi chú. */
  @IsString()
  @IsOptional()
  note?: string;
}
