import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePurchaseOrderDto {
  /** Mã đơn đặt hàng duy nhất. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  purchaseOrderCode: string;

  /** UUID của hợp đồng mua sắm. */
  @IsUUID()
  @IsOptional()
  contractId?: string;

  /** UUID của nhà cung cấp. */
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  /** UUID của nhân viên lập đơn. */
  @IsUUID()
  @IsNotEmpty()
  createdByEmployeeId: string;

  /** Ngày đặt hàng theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  orderDate: string;

  /** Ngày giao hàng dự kiến theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  expectedDeliveryDate: string;

  /** Tổng giá trị dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsNotEmpty()
  totalValue: string;

  /** Trạng thái. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  status: string;
}
