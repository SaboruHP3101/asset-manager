import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class RecordPurchaseReceiptItemDto {
  @IsUUID()
  purchaseOrderItemId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  deliveredQuantity: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNumbers?: string[];
}

export class RecordPurchaseReceiptDto {
  @IsDateString()
  deliveryDate: string;

  @IsString()
  @IsNotEmpty()
  deliveryNoteNumber: string;

  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  })
  @ValidateNested({ each: true })
  @Type(() => RecordPurchaseReceiptItemDto)
  @ArrayMinSize(1)
  items: RecordPurchaseReceiptItemDto[];
}

export class InspectPurchaseReceiptUnitDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value === 'true' : value,
  )
  @IsBoolean()
  accepted: boolean;

  @ValidateIf((dto: InspectPurchaseReceiptUnitDto) => !dto.accepted)
  @IsString()
  @IsNotEmpty()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CloseShortPurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
