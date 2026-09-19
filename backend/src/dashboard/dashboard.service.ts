import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, notInArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';

@Injectable()
/** Tổng hợp dữ liệu ngắn gọn cho Home, tránh tải toàn bộ bản ghi về mobile để đếm. */
export class DashboardService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Đếm tài sản đang giao và các yêu cầu chưa kết thúc do chính nhân viên tạo.
   * Ba truy vấn yêu cầu chạy song song để giảm thời gian phản hồi của dashboard.
   */
  async getMySummary(employeeId: string) {
    const [assetsResult, purchaseResult, transferResult, repairResult] =
      await Promise.all([
        this.db
          .select({ value: count(schema.assets.id) })
          .from(schema.assets)
          .where(eq(schema.assets.currentUserId, employeeId)),
        this.db
          .select({ value: count(schema.purchaseRequests.id) })
          .from(schema.purchaseRequests)
          .where(
            and(
              eq(schema.purchaseRequests.requesterId, employeeId),
              notInArray(schema.purchaseRequests.status, [
                'allocated',
                'cancelled',
              ]),
            ),
          ),
        this.db
          .select({ value: count(schema.transferRequests.id) })
          .from(schema.transferRequests)
          .where(
            and(
              eq(schema.transferRequests.initiatedBy, employeeId),
              notInArray(schema.transferRequests.status, [
                'completed',
                'cancelled',
              ]),
            ),
          ),
        this.db
          .select({ value: count(schema.repairRequests.id) })
          .from(schema.repairRequests)
          .where(
            and(
              eq(schema.repairRequests.reporterId, employeeId),
              notInArray(schema.repairRequests.status, ['closed', 'cancelled']),
            ),
          ),
      ]);

    return {
      assignedAssets: assetsResult[0]?.value ?? 0,
      activeRequests:
        (purchaseResult[0]?.value ?? 0) +
        (transferResult[0]?.value ?? 0) +
        (repairResult[0]?.value ?? 0),
    };
  }
}
