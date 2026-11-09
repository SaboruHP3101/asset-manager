import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';

@Injectable()
export class RepairCostsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /** Tổng hợp chi phí đã nghiệm thu theo tháng đóng phiếu, mỗi tài sản một dòng. */
  async listCosts(month: string, actor: AuthenticatedEmployee) {
    this.assertItDepartment(actor);

    const { assets, assetCategories, employees, repairRequests } = schema;
    // Tạo mốc ngày đầu tháng từ YYYY-MM. Giữ kiểu date để SQL tính mốc kế tiếp.
    const firstDay = sql`${month + '-01'}::date`;
    // Một truy vấn trả cả các dòng theo tài sản và tổng tháng từ cùng tập phiếu.
    const rows = await this.db
      .select({
        id: assets.id,
        code: assets.assetCode,
        // Dùng tên danh mục khi tài sản cũ chưa có tên riêng.
        name: sql<string>`coalesce(${assets.name}, ${assetCategories.name})`,
        holder: employees.fullName,
        location: assets.currentLocation,
        // Ép kiểu tiền dưới dạng chuỗi để giữ độ chính xác của numeric và phân biệt null với 0.
        cost: sql<string | null>`sum(${repairRequests.repairCost})::text`,
        // Cộng tổng từng nhóm tài sản để mỗi phiếu chỉ góp một lần vào tổng tháng.
        monthTotal: sql<
          string | null
        >`(sum(sum(${repairRequests.repairCost})) over ())::text`,
      })
      .from(repairRequests)
      .innerJoin(assets, eq(repairRequests.assetId, assets.id))
      .innerJoin(
        assetCategories,
        eq(assets.assetCategoryId, assetCategories.id),
      )
      // Tài sản hiện chưa giao cho ai vẫn có thể có chi phí trong tháng.
      .leftJoin(employees, eq(assets.currentUserId, employees.id))
      // Lọc theo ngày đóng sau nghiệm thu. Cận trên loại trừ đầu tháng sau theo giờ Việt Nam.
      .where(
        and(
          eq(repairRequests.status, 'closed'),
          eq(repairRequests.confirmationStatus, 'approved'),
          sql`${repairRequests.closedAt} >= (${firstDay}::timestamp at time zone 'Asia/Ho_Chi_Minh')`,
          sql`${repairRequests.closedAt} < ((${firstDay} + interval '1 month') at time zone 'Asia/Ho_Chi_Minh')`,
        ),
      )
      // Nhóm theo ID để hai tài sản trùng tên vẫn có hai dòng riêng.
      .groupBy(assets.id, assetCategories.name, employees.fullName)
      .orderBy(asc(assets.assetCode));

    return {
      // Hàm cửa sổ lặp tổng trên mỗi dòng, nên chỉ lấy một lần ở cấp báo cáo.
      total: rows[0]?.monthTotal ?? null,
      assets: rows.map(({ monthTotal: _monthTotal, ...asset }) => asset),
    };
  }

  /** Đọc các lần hoàn tất sửa chữa của tài sản */
  async listCostHistory(assetId: string, actor: AuthenticatedEmployee) {
    this.assertItDepartment(actor);

    const { employees, repairRequests, requestApprovals } = schema;

    // Đọc nhật ký vì mỗi phiếu chỉ giữ số tiền hiện tại, còn nhật ký giữ số tiền từng lần.
    const attempts = await this.db
      .select({
        id: requestApprovals.id,
        requestId: repairRequests.id,
        status: repairRequests.status,
        confirmation: repairRequests.confirmationStatus,
        date: requestApprovals.createdAt,
        // Lấy giá trị JSON dưới dạng chuỗi. Nhật ký cũ thiếu chi phí sẽ trả null.
        cost: sql<string | null>`${requestApprovals.metadata}->>'actualCost'`,
        // Người hiển thị là tài khoản xác nhận hoàn tất ở lần này, kể cả khi đã phân công lại.
        technician: employees.fullName,
      })
      .from(repairRequests)
      .innerJoin(
        requestApprovals,
        eq(requestApprovals.requestId, repairRequests.id),
      )
      .innerJoin(employees, eq(employees.id, requestApprovals.approvedBy))
      // Chỉ lấy sự kiện hoàn tất của phiếu sửa chữa, bỏ các bước duyệt và bàn giao.
      .where(
        and(
          eq(repairRequests.assetId, assetId),
          eq(requestApprovals.requestType, 'repair'),
          eq(requestApprovals.actionType, 'completed'),
        ),
      )
      // Duyệt mới trước và dùng ID để thứ tự ổn định nếu trùng thời điểm.
      .orderBy(desc(requestApprovals.createdAt), desc(requestApprovals.id));

    // Gặp một phiếu lần đầu nghĩa là đang ở lần hoàn tất mới nhất của chính phiếu đó.
    const seen = new Set<string>();

    return attempts.map(({ requestId, status, confirmation, ...attempt }) => {
      const latest = !seen.has(requestId);

      // Những lần cũ hơn của cùng phiếu đã phải sửa lại trước khi có lần hoàn tất mới.
      seen.add(requestId);

      // Chỉ lần cuối mới có thể khớp với quyết định nghiệm thu đang lưu trên phiếu.
      if (latest && status === 'closed' && confirmation === 'approved') {
        return { ...attempt, outcome: 'accepted' as const };
      }

      // Ưu tiên trạng thái đang chờ vì phiếu có thể còn dấu từ chối của lần trước.
      if (latest && status === 'ready_for_return') {
        return { ...attempt, outcome: 'pending' as const };
      }

      // Khi phiếu đang sửa lại, ngay cả lần hoàn tất mới nhất cũng đã bị trả.
      const returned =
        !latest || (status === 'in_progress' && confirmation === 'rejected');

      // Với dữ liệu còn lại, chỉ xác nhận có ghi nhận lần sửa vì chưa đủ căn cứ phân loại.
      return {
        ...attempt,
        outcome: returned ? ('returned' as const) : ('recorded' as const),
      };
    });
  }

  private assertItDepartment(actor: AuthenticatedEmployee) {
    if (actor.departmentName !== 'IT') {
      throw new ForbiddenException('Chỉ phòng IT được xem chi phí sửa chữa.');
    }
  }
}
