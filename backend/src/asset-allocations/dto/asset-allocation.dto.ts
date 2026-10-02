import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateAssetAllocationDto {
  @IsUUID()
  assetId: string;

  @IsUUID()
  recipientId: string;

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
