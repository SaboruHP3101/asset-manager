import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMyRepairRequestDto {
  // Tài sản được chọn từ danh sách hoặc mã QR
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  // Triệu chứng bắt buộc do nhân viên nhập
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  issueDescription: string;
}
