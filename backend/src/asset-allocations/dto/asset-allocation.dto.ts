import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateAssetAllocationDto {
  @IsUUID()
  assetId: string;

  @IsIn(['individual', 'shared_location'])
  targetType: 'individual' | 'shared_location' = 'individual';

  @ValidateIf(
    (dto: CreateAssetAllocationDto) => dto.targetType === 'individual',
  )
  @IsUUID()
  recipientId?: string;

  @IsUUID()
  departmentId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  location: string;
}

export class CreateAssetAllocationBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  assetIds: string[];

  @IsIn(['individual', 'shared_location'])
  targetType: 'individual' | 'shared_location';

  @ValidateIf(
    (dto: CreateAssetAllocationBatchDto) => dto.targetType === 'individual',
  )
  @IsUUID()
  recipientId?: string;

  @IsUUID()
  departmentId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  location: string;
}

export class AssetAllocationDecisionDto {
  @IsBoolean()
  confirmed: boolean;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((dto: AssetAllocationDecisionDto) => !dto.confirmed)
  @IsString()
  @IsNotEmpty()
  reason?: string;
}

export class AssetAllocationBatchDecisionDto extends AssetAllocationDecisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  allocationIds: string[];
}
