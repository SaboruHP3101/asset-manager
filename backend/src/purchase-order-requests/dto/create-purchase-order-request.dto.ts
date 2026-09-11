import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePurchaseOrderRequestDto {
  /** UUID của đơn đặt hàng. */
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId: string;

  /** UUID của yêu cầu mua sắm. */
  @IsUUID()
  @IsNotEmpty()
  purchaseRequestId: string;
}
