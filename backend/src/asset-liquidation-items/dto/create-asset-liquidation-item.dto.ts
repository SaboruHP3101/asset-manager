import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAssetLiquidationItemDto {
  /** UUID của đề nghị thanh lý. */
  @IsUUID()
  @IsNotEmpty()
  liquidationId: string;

  /** UUID của tài sản. */
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  /** Giá trị thanh lý dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsNotEmpty()
  liquidationValue: string;

  /** Ghi chú. */
  @IsString()
  @IsOptional()
  note?: string;
}
