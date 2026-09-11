import {
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePurchaseOrderItemDto {
  /** UUID của đơn đặt hàng. */
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId: string;

  /** UUID của danh mục tài sản. */
  @IsUUID()
  @IsNotEmpty()
  assetCategoryId: string;

  /** Tên hạng mục đặt mua. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemName: string;

  /** Số lượng. */
  @IsInt()
  @IsNotEmpty()
  quantity: number;

  /** Đơn giá dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsNotEmpty()
  unitPrice: string;

  /** Thành tiền dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsNotEmpty()
  totalAmount: string;
}
