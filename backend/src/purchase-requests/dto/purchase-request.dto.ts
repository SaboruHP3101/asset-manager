import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class PurchaseRequestItemDto {
  @IsUUID()
  assetCategoryId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemName: string;

  @IsString()
  @IsNotEmpty()
  specifications: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  purpose?: string;
}

export class SavePurchaseRequestDto {
  @IsDateString()
  neededByDate: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsOptional()
  @IsString()
  note?: string;

  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemDto)
  @ArrayMinSize(1)
  items: PurchaseRequestItemDto[];
}

export class PurchaseRequestDecisionDto {
  @IsBoolean()
  approved: boolean;

  @ValidateIf((dto: PurchaseRequestDecisionDto) => !dto.approved)
  @IsString()
  @IsNotEmpty()
  reason?: string;
}

export class CreatePurchaseQuoteDto {
  @IsUUID()
  requestItemId: string;

  @IsUUID()
  supplierId: string;

  @Matches(/^\d+$/, { message: 'Đơn giá phải là số nguyên VND không âm.' })
  unitPriceExclVat: string;

  @Matches(/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/, {
    message: 'VAT phải nằm trong khoảng 0 đến 100, tối đa hai số lẻ.',
  })
  vatRate: string;

  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  isSelected: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
