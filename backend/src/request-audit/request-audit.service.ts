import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';

export type RequestType = 'purchase' | 'transfer' | 'repair';
export type ApprovalResult = 'approved' | 'rejected' | 'pending';

/** Dữ liệu chuẩn hóa cho một hành động phát sinh trong bất kỳ workflow nào. */
export interface AuditEntry {
  requestType: RequestType;
  requestId: string;
  actionType: string;
  approvedBy: string;
  approverRole: string;
  status: ApprovalResult;
  notes?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
/** Ghi và truy vấn dấu vết kiểm toán dùng chung để ba workflow có cùng cấu trúc log. */
export class RequestAuditService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Ghi nhật ký trong cùng transaction với thay đổi nghiệp vụ. Cách này bảo đảm
   * trạng thái yêu cầu và dấu vết kiểm toán không thể bị lệch nhau khi có lỗi DB.
   */
  async log(
    db: NodePgDatabase<typeof schema>,
    entry: AuditEntry,
  ): Promise<void> {
    await db.insert(schema.requestApprovals).values({
      ...entry,
      metadata: entry.metadata ?? null,
    });
  }

  /** Trả nhật ký theo thứ tự thời gian để giao diện có thể dựng timeline xử lý. */
  findTrail(requestType: RequestType, requestId: string) {
    return this.db
      .select()
      .from(schema.requestApprovals)
      .where(
        and(
          eq(schema.requestApprovals.requestType, requestType),
          eq(schema.requestApprovals.requestId, requestId),
        ),
      )
      .orderBy(asc(schema.requestApprovals.createdAt));
  }
}
