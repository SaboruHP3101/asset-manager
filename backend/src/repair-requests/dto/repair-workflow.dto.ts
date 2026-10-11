import {
  IsBoolean,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class RepairDecisionDto {
  @IsBoolean()
  approved: boolean;

  @ValidateIf((dto: RepairDecisionDto) => !dto.approved)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;
}

export class RepairHandoverDecisionDto {
  @IsBoolean()
  confirmed: boolean;

  @ValidateIf((dto: RepairHandoverDecisionDto) => !dto.confirmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;
}

/** Chỉ định kỹ thuật viên chịu trách nhiệm xử lý yêu cầu. */
export class AssignRepairDto {
  /** Đây là người được giao việc; người thực hiện thao tác vẫn được lấy từ JWT. */
  @IsUUID()
  assignedTo: string;
}

/** Kết quả do IT ghi nhận sau khi hoàn thành công việc sửa chữa. */
export class CompleteRepairDto {
  /** Mô tả công việc đã làm để người báo hỏng có cơ sở nghiệm thu. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resultNotes: string;

  @IsNumberString()
  @IsOptional()
  actualCost?: string;
}

/** Phản hồi nghiệm thu của chính nhân viên đã báo hỏng tài sản. */
export class ConfirmRepairDto {
  /** false đưa yêu cầu về in_progress để IT xử lý lại thay vì đóng luồng. */
  @IsBoolean()
  accepted: boolean;

  @ValidateIf((dto: ConfirmRepairDto) => !dto.accepted)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;
}
