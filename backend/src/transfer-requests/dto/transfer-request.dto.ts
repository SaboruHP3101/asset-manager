import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Dữ liệu người dùng cung cấp khi đề nghị điều chuyển một tài sản. */
export class CreateTransferRequestDto {
  /** Tài sản cần điều chuyển; người khởi tạo và phòng nguồn được lấy từ JWT. */
  @IsUUID()
  assetId: string;

  @IsUUID()
  toDepartmentId: string;

  @IsUUID()
  @IsOptional()
  toUserId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  newLocation?: string;

  @IsString()
  reason: string;
}

/** Quyết định của trưởng phòng nguồn đối với yêu cầu điều chuyển. */
export class TransferApprovalDto {
  /** true tiếp tục bước xác minh, false kết thúc yêu cầu bằng cancelled. */
  @IsBoolean()
  approved: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}
/** Phòng ban sẽ quản lý tài sản sau khi hai bên hoàn tất bàn giao. */
/** Người nhận cụ thể là tùy chọn khi điều chuyển cho cả phòng ban. */
/** Vị trí vật lý mới giúp kiểm kê tài sản sau điều chuyển. */
/** Lý do là căn cứ để trưởng phòng nguồn phê duyệt yêu cầu. */
/** Ghi chú hỗ trợ audit và giải thích quyết định cho người tạo yêu cầu. */
