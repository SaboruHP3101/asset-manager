import {
  IsDateString,
  IsNotEmpty,
  IsIn,
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

  /** Ngày báo hỏng theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  reportDate: string;

  /** Mô tả sự cố. */
  @IsString()
  @IsNotEmpty()
  issueDescription: string;

  /** Trạng thái. */
  @IsIn([
    'reported',
    'assessed',
    'approval_pending',
    'in_progress',
    'completed',
    'confirmed',
    'rejected',
    'closed',
    'cancelled',
  ])
  @IsOptional()
  @MaxLength(100)
  status?:
    | 'reported'
    | 'assessed'
    | 'approval_pending'
    | 'in_progress'
    | 'completed'
    | 'confirmed'
    | 'rejected'
    | 'closed'
    | 'cancelled';

  /** Chi phí sửa chữa dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsOptional()
  repairCost?: string;
}
