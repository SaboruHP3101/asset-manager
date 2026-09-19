import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Dữ liệu quyết định dùng chung cho các cấp duyệt của yêu cầu mua sắm. */
export class ApprovalDecisionDto {
  /** true để duyệt, false để từ chối và kết thúc yêu cầu. */
  @IsBoolean()
  approved: boolean;

  /** Ghi chú là tùy chọn để lưu lý do duyệt hoặc từ chối vào audit trail. */
  @IsString()
  @IsOptional()
  note?: string;
}

/** Thông tin thương mại cần có khi bộ phận thu mua chuyển yêu cầu thành đơn hàng. */
export class CreateOrderDto {
  /** Nhà cung cấp phải tồn tại để bảo đảm khóa ngoại và truy vết nguồn mua. */
  @IsUUID()
  supplierId: string;

  /** Số hóa đơn được giới hạn độ dài để phù hợp cột dữ liệu và dữ liệu đối soát. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  invoiceNumber: string;
}

/** Mô tả một tài sản vật lý được tạo từ lô hàng vừa nhận. */
export class ReceivedAssetDto {
  /** Tên hiển thị giúp nhận biết tài sản ngoài mã quản lý nội bộ. */
  /** Mã tài sản do đơn vị quản lý cấp và phải duy nhất ở tầng cơ sở dữ liệu. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /** Nội dung QR dùng để tra cứu hoặc quét tài sản trên ứng dụng di động. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  qrCode: string;

  /** Giá trị tiền dùng chuỗi số để tránh sai số số thực khi ghi vào numeric của PostgreSQL. */
  @IsNumberString()
  initialValue: string;

  /** Ngày mua phải là ngày ISO để API và cơ sở dữ liệu diễn giải thống nhất. */
  @IsDateString()
  purchaseDate: string;

  /** Ngày đưa vào sử dụng phục vụ tính khấu hao và theo dõi vòng đời tài sản. */
  @IsDateString()
  inServiceDate: string;
}

/** Danh sách tài sản nhận cho một yêu cầu; service kiểm tra số lượng khớp yêu cầu gốc. */
export class ReceiveAssetsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivedAssetDto)
  assets: ReceivedAssetDto[];
}

/** Chỉ định nhân viên nhận toàn bộ tài sản đã tạo từ yêu cầu mua sắm. */
export class AllocateAssetsDto {
  /** Danh tính người xác nhận được lấy từ JWT, trường này chỉ là người nhận tài sản. */
  @IsUUID()
  allocatedToUserId: string;
}
