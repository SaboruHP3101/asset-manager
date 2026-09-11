import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAssetDto {
  /** Mã tài sản duy nhất. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetCode: string;

  /** Mã QR duy nhất của tài sản. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  qrCode: string;

  /** UUID của danh mục tài sản. */
  @IsUUID()
  @IsNotEmpty()
  assetCategoryId: string;

  /** UUID của nhà cung cấp. */
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  /** UUID của nhân viên đang sử dụng tài sản. */
  @IsUUID()
  @IsOptional()
  currentUserId?: string;

  /** UUID của phòng ban đang quản lý tài sản. */
  @IsUUID()
  @IsOptional()
  currentManagingDepartmentId?: string;

  /** UUID của hạng mục đơn đặt hàng. */
  @IsUUID()
  @IsOptional()
  purchaseOrderItemId?: string;

  /** Trạng thái. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  status: string;

  /** Nguyên giá dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsNotEmpty()
  initialValue: string;

  /** Ngày mua theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  purchaseDate: string;

  /** Ngày đưa vào sử dụng theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  inServiceDate: string;
}
