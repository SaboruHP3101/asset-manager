import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateAssetRecallRequestDto {
  @IsIn(['exchange', 'upgrade', 'disposal'])
  type: 'exchange' | 'upgrade' | 'disposal' = 'exchange';

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
  @IsOptional()
  @IsUUID()
  replacementAssetId?: string;
}

export class CompleteDisposalDto {
  @IsDateString()
  disposalDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  disposalMethod: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  processingResult?: string;

  @IsOptional()
  @IsNumberString()
  recoveryValue?: string;
}

export class CompleteUpgradeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  processingResult: string;
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
