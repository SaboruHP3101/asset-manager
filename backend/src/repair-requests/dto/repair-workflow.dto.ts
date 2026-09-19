import {
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/** Kết quả đánh giá ban đầu của IT, quyết định yêu cầu có cần duyệt chi phí hay không. */
export class AssessRepairDto {
  /** Mô tả chẩn đoán để kỹ thuật viên và người duyệt hiểu tình trạng tài sản. */
  @IsString()
  notes: string;

  @IsBoolean()
  needsApproval: boolean;

  @IsNumberString()
  @IsOptional()
  estimatedCost?: string;
}

/** Quyết định của trưởng bộ phận đối với yêu cầu sửa chữa đang chờ duyệt. */
export class RepairApprovalDto {
  @IsBoolean()
  approved: boolean;

  @IsString()
  @IsOptional()
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

  @IsString()
  @IsOptional()
  note?: string;
}
/** Bật nhánh approval_pending khi chi phí hoặc phạm vi sửa chữa cần trưởng bộ phận duyệt. */
/** Chi phí ước tính là tùy chọn và dùng chuỗi để giữ chính xác kiểu numeric. */
/** Ghi lại lý do, đặc biệt cần thiết khi từ chối và đóng yêu cầu. */
/** Chi phí thực tế dùng cho đối soát với chi phí ước tính và báo cáo. */
/** Cho phép người dùng giải thích lý do không chấp nhận kết quả sửa chữa. */
