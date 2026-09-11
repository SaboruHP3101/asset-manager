import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateApprovalHistoryDto {
  /** Loại đối tượng. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  entityType: string;

  /** UUID của đối tượng. */
  @IsUUID()
  @IsNotEmpty()
  entityId: string;

  /** UUID của nhân viên phê duyệt. */
  @IsUUID()
  @IsNotEmpty()
  approverId: string;

  /** Thứ tự bước phê duyệt. */
  @IsInt()
  @IsNotEmpty()
  approvalStep: number;

  /** Hành động. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  action: string;

  /** Trạng thái trước đó. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  previousStatus: string;

  /** Trạng thái mới. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  newStatus: string;

  /** Ghi chú. */
  @IsString()
  @IsOptional()
  note?: string;
}
