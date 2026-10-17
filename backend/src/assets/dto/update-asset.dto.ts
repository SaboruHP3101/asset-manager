import { PartialType, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateAssetDto } from './create-asset.dto.js';

export class UpdateAssetDto extends PartialType(
  PickType(CreateAssetDto, [
    'assetCode',
    'assetCategoryId',
    'supplierId',
    'initialValue',
    'purchaseDate',
    'inServiceDate',
  ] as const),
) {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}
