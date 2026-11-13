import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { formatISO, isValid, parseISO } from 'date-fns';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { getAllowedWorkflowActions } from '../auth/workflow-actions.config.js';
import { ChatMessageDto, ChatQueryDto, type ChatReply } from './chat.dto.js';
import {
  GeminiService,
  isObject,
  type GeminiContent,
  type GeminiPart,
} from './gemini.service.js';
import { ChatQueryService } from './chat-query.service.js';
import { buildChatReply } from './chat-response.js';
import { findReadTool } from './tools/index.js';
import { toolArguments } from './tools/read-tool.js';

const sources = {
  assets: 'Tài sản (lọc ngày mua)',
  handovers: 'Lịch sử bàn giao',
  inventory: 'Bản ghi kiểm kê, không phải tiến độ kỳ kiểm kê',
  repairs: 'Phiếu sửa chữa (lọc ngày báo)',
  purchase_requests: 'Đề nghị mua sắm (lọc ngày tạo)',
  purchase_orders: 'PO (lọc ngày đặt, tổng gồm VAT)',
  warehouse: 'Kho IT',
  depreciation: 'Khấu hao (không chọn ngày: kỳ mới nhất theo trạng thái)',
  permissions: 'Quyền hiện tại của bạn',
};

interface ConversationTurn {
  question: string;
  queries: ChatQueryDto[];
}
interface Conversation {
  actorId: string;
  expiresAt: number;
  turns: ConversationTurn[];
}

function toolResult(reply: ChatReply) {
  return {
    message: reply.message.slice(0, 6000),
    source: reply.source,
    scope: reply.scope,
    asOf: reply.asOf,
    total: reply.total,
    hasMore: reply.hasMore,
    rows: reply.rows.map((row) => ({
      title: row.title,
      fields: row.fields.map((field) => ({
        ...field,
        value:
          field.value.length > 1000
            ? `${field.value.slice(0, 1000)}… [nội dung rút gọn]`
            : field.value,
      })),
    })),
    csvAvailable: Boolean(reply.csv),
    presentation: reply.rows.some((row) => row.kind === 'asset')
      ? 'asset_carousel'
      : 'records',
  };
}

async function validateQuery(
  args: Record<string, unknown>,
): Promise<ChatQueryDto> {
  const query = plainToInstance(ChatQueryDto, args);

  if (
    args.limit === undefined &&
    ['assets', 'warehouse'].includes(query.domain)
  ) {
    query.limit = 5;
  }

  const errors = await validate(query, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length) {
    throw new BadRequestException(
      'Tool chỉ nhận phép đọc và bộ lọc đã khai báo.',
    );
  }

  for (const date of [query.fromDate, query.toDate]) {
    if (
      date &&
      (!isValid(parseISO(date)) ||
        formatISO(parseISO(date), { representation: 'date' }) !== date)
    ) {
      throw new BadRequestException('Ngày không hợp lệ.');
    }
  }

  if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
    throw new BadRequestException('Khoảng ngày không hợp lệ.');
  }

  if (
    query.scope === 'queue' &&
    !['purchase_requests', 'repairs'].includes(query.domain)
  ) {
    throw new BadRequestException(
      'Queue chỉ áp dụng cho đề nghị mua và sửa chữa.',
    );
  }

  if (
    query.operation === 'usage_duration' &&
    !['assets', 'warehouse'].includes(query.domain)
  ) {
    throw new BadRequestException(
      'Thời gian sử dụng cần domain tài sản hoặc kho IT.',
    );
  }

  return query;
}

@Injectable()
export class ChatService {
  private readonly pending = new Set<string>();
  private readonly conversations = new Map<string, Conversation>();

  constructor(
    private readonly gemini: GeminiService,
    private readonly queries: ChatQueryService,
  ) {}

  private async read(
    query: ChatQueryDto,
    actor: AuthenticatedEmployee,
  ): Promise<ChatReply> {
    const records = await this.queries.read(query, actor);
    const scope = this.describeScope(query);

    return buildChatReply(query, records, sources[query.domain], scope);
  }

  private describeScope(query: ChatQueryDto): string {
    if (query.domain === 'depreciation') {
      const provisional = ['draft', 'pending_approval'].includes(query.status);

      return provisional
        ? 'Theo quyền khấu hao; số liệu dự kiến, chưa ghi nhận'
        : 'Theo quyền khấu hao; số liệu đã ghi nhận';
    }

    if (query.domain === 'inventory')
      return 'Tài sản đang giao cho bạn hoặc bản ghi do bạn kiểm kê';

    if (query.domain === 'handovers') return 'Tài sản đang giao cho bạn';

    if (query.scope === 'queue')
      return 'Công việc chờ bạn xử lý, giống tab Chờ xử lý hiện tại';

    if (query.scope === 'mine' && query.domain !== 'warehouse')
      return 'Dữ liệu của bạn';

    return 'Trong phạm vi quyền hiện tại của bạn';
  }

  private async refreshContext(
    existing: Conversation | undefined,
    actor: AuthenticatedEmployee,
  ) {
    const context = [];

    // Refresh saved query plans so historical results respect current permissions.
    for (const turn of existing?.turns ?? []) {
      const results = [];

      for (const query of turn.queries) {
        try {
          results.push(toolResult(await this.read(query, actor)));
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;

          results.push({ error: 'Dữ liệu trước không còn được phép xem.' });
        }
      }

      context.push({ question: turn.question, results });
    }

    return context;
  }

  async ask(
    dto: ChatMessageDto,
    actor: AuthenticatedEmployee,
  ): Promise<ChatReply> {
    if (this.pending.has(actor.id) || this.pending.size >= 8) {
      throw new HttpException(
        'Trợ lý đang xử lý câu hỏi. Vui lòng chờ và thử lại.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    for (const [id, conversation] of this.conversations) {
      if (conversation.expiresAt <= Date.now()) this.conversations.delete(id);
    }

    const existing = dto.conversationId
      ? this.conversations.get(dto.conversationId)
      : undefined;

    if (dto.conversationId && (!existing || existing.actorId !== actor.id)) {
      throw new NotFoundException(
        'Cuộc trò chuyện đã hết hạn. Vui lòng chọn Cuộc trò chuyện mới.',
      );
    }

    this.pending.add(actor.id);

    try {
      const conversationId = dto.conversationId ?? randomUUID();
      const signal = AbortSignal.timeout(75_000);
      const context = await this.refreshContext(existing, actor);

      const contents: GeminiContent[] = [
        {
          role: 'user',
          parts: [
            {
              text: JSON.stringify({
                message: dto.message,
                context,
                previousQuestions: dto.previousQuestions ?? [],
              }),
            },
          ],
        },
      ];
      const executed: ChatQueryDto[] = [];
      const replies: ChatReply[] = [];
      let calls = 0;

      for (let round = 0; round < 5; round++) {
        const content = await this.gemini.generate(
          contents,
          signal,
          round < 4 && calls < 6,
          {
            departmentName: actor.departmentName,
            isDepartmentHead: actor.isDepartmentHead,
            allowedActions: getAllowedWorkflowActions(
              actor.roleName,
              actor.isDepartmentHead,
              actor.departmentName,
            ),
          },
        );
        const toolCalls = content.parts.filter(
          (part) => part.functionCall !== undefined,
        );

        if (!toolCalls.length) {
          const message = content.parts
            .filter(
              (part) => part.thought !== true && typeof part.text === 'string',
            )
            .map((part) => part.text as string)
            .join('')
            .trim();

          if (!message || message.length > 6000) {
            throw new ServiceUnavailableException(
              'Chưa nhận được câu trả lời hoàn chỉnh. Vui lòng thử lại.',
            );
          }

          const csv = replies.find((result) => result.csv)?.csv;
          const reply: ChatReply = {
            conversationId,
            message,
            source:
              [...new Set(replies.map((result) => result.source))].join('; ') ||
              'Trợ lý chỉ đọc; ngữ cảnh được đọc lại theo quyền hiện tại',
            scope:
              [...new Set(replies.map((result) => result.scope))].join('; ') ||
              'Trong phạm vi quyền hiện tại của bạn',
            asOf: new Date().toISOString(),
            total: replies.length === 1 ? replies[0].total : null,
            hasMore:
              replies.some((result) => result.hasMore) ||
              replies.reduce((sum, result) => sum + result.rows.length, 0) > 20,
            rows: replies.flatMap((result) => result.rows).slice(0, 20),
            ...(csv ? { csv } : {}),
          };
          const turns = [
            ...(existing?.turns ?? []),
            { question: dto.message, queries: executed },
          ].slice(-4);

          if (!existing && this.conversations.size >= 100) {
            const oldest = this.conversations.keys().next().value;

            if (oldest) this.conversations.delete(oldest);
          }

          this.conversations.set(conversationId, {
            actorId: actor.id,
            expiresAt: Date.now() + 20 * 60_000,
            turns,
          });

          return reply;
        }

        if (round === 4 || calls + toolCalls.length > 6) {
          throw new ServiceUnavailableException(
            'Câu hỏi cần quá nhiều lượt tra cứu. Vui lòng chia nhỏ câu hỏi.',
          );
        }

        contents.push(content);

        const responses: GeminiPart[] = [];

        for (const part of toolCalls) {
          calls++;

          const call = part.functionCall;

          if (
            !isObject(call) ||
            typeof call.name !== 'string' ||
            (call.id !== undefined && typeof call.id !== 'string')
          ) {
            throw new ServiceUnavailableException(
              'Gemini trả về lời gọi tool không hợp lệ. Vui lòng thử lại.',
            );
          }

          let result: unknown;

          try {
            const query = await validateQuery(
              toolArguments(findReadTool(call.name), call.args),
            );

            if (
              query.operation === 'export' &&
              replies.some((reply) => reply.csv)
            ) {
              throw new BadRequestException(
                'Mỗi lượt chỉ xuất một báo cáo CSV.',
              );
            }

            const reply = await this.read(query, actor);

            executed.push(query);
            replies.push(reply);
            result = toolResult(reply);
          } catch (error) {
            if (
              !(error instanceof BadRequestException) &&
              !(error instanceof ForbiddenException)
            )
              throw error;

            result = { error: error.message };
          }

          responses.push({
            functionResponse: {
              name: call.name,
              ...(call.id ? { id: call.id } : {}),
              response: result,
            },
          });
        }

        contents.push({ role: 'user', parts: responses });
      }

      throw new ServiceUnavailableException(
        'Vui lòng chia nhỏ câu hỏi để tiếp tục tra cứu.',
      );
    } finally {
      this.pending.delete(actor.id);
    }
  }
}
