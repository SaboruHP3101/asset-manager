import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateAssetRecallRequestDto {
  @IsUUID()
  assetId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class UpdateAssetRecallRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class RecallDecisionDto {
  @IsBoolean()
  approved: boolean;

  @ValidateIf((dto: RecallDecisionDto) => !dto.approved)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason?: string;
}

export class ItRecallDecisionDto extends RecallDecisionDto {
  @ValidateIf((dto: ItRecallDecisionDto) => dto.approved)
  @IsUUID()
  replacementAssetId?: string;
}

export class RecallHandoverDecisionDto {
  @IsBoolean()
  confirmed: boolean;

  @ValidateIf((dto: RecallHandoverDecisionDto) => !dto.confirmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason?: string;
}
