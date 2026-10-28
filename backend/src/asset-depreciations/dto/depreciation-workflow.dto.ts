import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class DepreciationSettingsDto {
  // Kiểm tra chuỗi được gửi có phải đúng format ngày tháng
  // YYYY-MM-DD hay không. Ví dụ: 2026-12-22
  @Matches(/^\d{4}-\d{2}-01$/)
  @IsDateString({ strict: true })
  firstMonth: string;
}

export class DepreciationProfileDto extends DepreciationSettingsDto {
  // Số nguyên dương, tối đa 18 chữ số.
  @Matches(/^[1-9]\d{0,17}$/)
  originalCost: string;

  // Số nguyên dương, tối đa 18 chữ số.
  @Matches(/^(0|[1-9]\d{0,17})$/)
  openingValue: string;

  // Kiểm tra chuỗi được gửi có phải đúng format ngày tháng
  // YYYY-MM-DD hay không. Ví dụ: 2026-12-22
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate: string;

  @IsInt()
  @Min(1)
  @Max(1200)
  termMonths: number;

  @IsInt()
  @Min(1)
  @Max(1200)
  remainingMonths: number;

  // Kiểm tra chuỗi được gửi có phải đúng format ngày tháng
  // YYYY-MM-DD hay không. Ví dụ: 2026-12-22
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  stopDate?: string | null;
}

export class DepreciationDecisionDto {
  @IsIn(['approve', 'return'])
  decision: 'approve' | 'return';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
