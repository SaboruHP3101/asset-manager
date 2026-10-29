import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ChatMessageDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  previousQuestions?: string[];

  @IsOptional()
  @IsUUID('4')
  conversationId?: string;
}

export const CHAT_DOMAINS = [
  'assets',
  'handovers',
  'inventory',
  'repairs',
  'purchase_requests',
  'purchase_orders',
  'warehouse',
  'depreciation',
  'permissions',
] as const;

export const CHAT_OPERATIONS = [
  'list',
  'count',
  'sum',
  'group',
  'export',
  'usage_duration',
] as const;
export const CHAT_METRICS = [
  'count',
  'initialValue',
  'repairCost',
  'depreciationAmount',
  'remainingValue',
  'originalCost',
  'totalInclVat',
] as const;
export const CHAT_GROUPS = [
  'status',
  'department',
  'category',
  'supplier',
  'assetCode',
] as const;

export class ChatQueryDto {
  @IsIn(CHAT_DOMAINS)
  domain: (typeof CHAT_DOMAINS)[number];

  @IsIn(CHAT_OPERATIONS)
  operation: (typeof CHAT_OPERATIONS)[number];

  @IsIn(CHAT_METRICS)
  metric: (typeof CHAT_METRICS)[number] = 'count';

  @IsIn(CHAT_GROUPS)
  groupBy: (typeof CHAT_GROUPS)[number] = 'status';

  @IsIn(['mine', 'queue', 'allowed'])
  scope: 'mine' | 'queue' | 'allowed' = 'allowed';

  @IsString()
  @MaxLength(120)
  search: string = '';

  @IsString()
  @MaxLength(100)
  assetCode: string = '';

  @IsString()
  @MaxLength(100)
  status: string = '';

  @Matches(/^(?:\d{4}-\d{2}-\d{2})?$/)
  fromDate: string = '';

  @Matches(/^(?:\d{4}-\d{2}-\d{2})?$/)
  toDate: string = '';

  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 10;

  @IsInt()
  @Min(0)
  @Max(2000)
  offset: number = 0;
}

export type ChatRecord = Record<string, string | number | Date | null>;

export interface ChatRow {
  kind?: 'asset';
  title: string;
  fields: { label: string; value: string }[];
  imageUrl?: string;
}

export interface ChatReply {
  conversationId?: string;
  message: string;
  source: string;
  scope: string;
  asOf: string;
  total: number | null;
  hasMore: boolean;
  rows: ChatRow[];
  csv?: string;
}
