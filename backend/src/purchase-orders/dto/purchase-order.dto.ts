import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class PurchaseOrderItemDto {
  @IsUUID()
  purchaseRequestItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class SavePurchaseOrderDto {
  @IsUUID()
  purchaseRequestId: string;

  @IsUUID()
  supplierId: string;

  @IsDateString()
  orderDate: string;

  @IsDateString()
  expectedDeliveryDate: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  @ArrayMinSize(1)
  items: PurchaseOrderItemDto[];
}

/** Quyết định duyệt hoặc trả đơn mua về nháp của Trưởng Thu mua. */
export class PurchaseOrderDecisionDto {
  @IsBoolean()
  approved: boolean;

  @ValidateIf((dto: PurchaseOrderDecisionDto) => !dto.approved)
  @IsString()
  @IsNotEmpty()
  reason?: string;
}

/** Lý do bắt buộc khi hủy một đơn mua đã phát hành. */
export class CancelPurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class PurchaseOrderQueryDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsIn([
    'draft',
    'pending_procurement_head',
    'issued',
    'partially_received',
    'fully_received',
    'closed_short',
    'cancelled',
  ])
  status?: string;
}
