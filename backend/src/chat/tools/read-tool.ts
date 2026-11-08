import { BadRequestException } from '@nestjs/common';
import {
  CHAT_GROUPS,
  CHAT_METRICS,
  CHAT_OPERATIONS,
  type ChatQueryDto,
} from '../chat.dto.js';

export interface ReadTool {
  domain: ChatQueryDto['domain'];
  scope?: ChatQueryDto['scope'];
  definition: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties: false;
    };
  };
}

export function defineReadTool(
  domain: ChatQueryDto['domain'],
  description: string,
  options: { name?: string; scope?: ChatQueryDto['scope'] } = {},
): ReadTool {
  const assets = domain === 'assets' || domain === 'warehouse';
  const queue = domain === 'repairs' || domain === 'purchase_requests';

  return {
    domain,
    scope: options.scope,
    definition: {
      name: options.name ?? 'read_' + domain,
      description,
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: CHAT_OPERATIONS.filter(
              (operation) => assets || operation !== 'usage_duration',
            ),
          },
          metric: { type: 'string', enum: CHAT_METRICS },
          groupBy: { type: 'string', enum: CHAT_GROUPS },
          ...(!options.scope
            ? {
                scope: {
                  type: 'string',
                  enum: queue
                    ? ['mine', 'queue', 'allowed']
                    : ['mine', 'allowed'],
                },
              }
            : {}),
          search: {
            type: 'string',
            maxLength: 120,
          },
          assetCode: {
            type: 'string',
            maxLength: 100,
          },
          status: { type: 'string', maxLength: 100 },
          fromDate: {
            type: 'string',
            description: 'YYYY-MM-DD',
          },
          toDate: {
            type: 'string',
            description: 'YYYY-MM-DD',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
          },
          offset: { type: 'integer', minimum: 0, maximum: 2000 },
        },
        required: ['operation'],
        additionalProperties: false,
      },
    },
  };
}

export function toolArguments(
  tool: ReadTool | undefined,
  args: unknown,
): Record<string, unknown> {
  if (!tool)
    throw new BadRequestException(
      'Tool không được hỗ trợ; chỉ được tra cứu dữ liệu.',
    );

  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new BadRequestException('Tham số tool phải là object.');
  }

  if ('domain' in args)
    throw new BadRequestException(
      'Nghiệp vụ được xác định bởi tên tool, không nhận domain.',
    );

  if (tool.scope && 'scope' in args)
    throw new BadRequestException(
      'Tool này có phạm vi cố định, không nhận scope.',
    );

  return {
    ...args,
    domain: tool.domain,
    ...(tool.scope ? { scope: tool.scope } : {}),
  };
}
