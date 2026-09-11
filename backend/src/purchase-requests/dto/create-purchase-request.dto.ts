import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePurchaseRequestDto {
  /** UUID của nhân viên yêu cầu. */
  @IsUUID()
  @IsNotEmpty()
  requesterId: string;

  /** UUID của phòng ban. */
  @IsUUID()
  @IsNotEmpty()
  departmentId: string;

  /** UUID của danh mục tài sản. */
  @IsUUID()
  @IsNotEmpty()
  assetCategoryId: string;

  /** Số lượng. */
  @IsInt()
  @IsNotEmpty()
  quantity: number;

  /** Ngày yêu cầu theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  requestDate: string;

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
