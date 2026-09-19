import {
  IsDateString,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePurchaseRequestDto {
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
  @IsIn([
    'draft',
    'submitted',
    'dept_approved',
    'finance_approved',
    'exec_approved',
    'ordered',
    'received',
    'asset_created',
    'allocated',
    'cancelled',
  ])
  @IsOptional()
  @MaxLength(100)
  status?:
    | 'draft'
    | 'submitted'
    | 'dept_approved'
    | 'finance_approved'
    | 'exec_approved'
    | 'ordered'
    | 'received'
    | 'asset_created'
    | 'allocated'
    | 'cancelled';

  /** Lý do. */
  @IsString()
  @IsNotEmpty()
  reason: string;
}
