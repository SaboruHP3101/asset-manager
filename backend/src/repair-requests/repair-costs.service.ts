import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import type { UpdateRepairCostDto } from './dto/repair-workflow.dto.js';

type MonthlyRepairRequest = {
  id: string;
  closedAt: string;
  issue: string;
  cost: string | null;
};

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
    // Query trả cả các dòng theo tài sản và tổng tháng.
    const rows = await this.db
      .select({
        id: assets.id,
        code: assets.assetCode,
        // Dùng tên danh mục khi tài sản chưa có tên riêng.
        name: sql<string>`coalesce(${assets.name}, ${assetCategories.name})`,
        holder: employees.fullName,
        location: assets.currentLocation,
        // Ép kiểu tiền dưới dạng chuỗi để giữ độ chính xác và phân biệt null với 0.
        cost: sql<string | null>`sum(${repairRequests.repairCost})::text`,
        requests: sql<MonthlyRepairRequest[]>`
          jsonb_agg(
            jsonb_build_object(
              'id', ${repairRequests.id},
              'closedAt', ${repairRequests.closedAt},
              'issue', ${repairRequests.issueDescription},
              'cost', ${repairRequests.repairCost}::text
            ) order by ${repairRequests.closedAt} desc, ${repairRequests.id} desc
          )
        `,
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
      // Tài sản chưa giao cho ai vẫn có thể có chi phí trong tháng.
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
      // Sử dụng ID để nhóm vì tài sản có thể trùng tên.
      .groupBy(assets.id, assetCategories.name, employees.fullName)
      .orderBy(asc(assets.assetCode));

    return {
      // Chỉ cần lấy item đầu để báo cáo.
      total: rows[0]?.monthTotal ?? null,
      assets: rows.map(({ monthTotal: _monthTotal, ...asset }) => asset),
    };
  }

  /** Cập nhật chi phí và lưu lý do trong cùng một giao dịch. */
  async updateCost(
    id: string,
    dto: UpdateRepairCostDto,
    actor: AuthenticatedEmployee,
  ) {
    this.assertItDepartment(actor);
    const employeeId = actor.id;
    const { repairRequests, changeHistory } = schema;
    const cost = BigInt(dto.cost).toString();

    await this.db.transaction(async (tx) => {
      const [request] = await tx
        .select({ cost: repairRequests.repairCost })
        .from(repairRequests)
        .where(
          and(
            eq(repairRequests.id, id),
            eq(repairRequests.status, 'closed'),
            eq(repairRequests.confirmationStatus, 'approved'),
          ),
        )
        .for('update');

      if (!request) {
        throw new NotFoundException(
          'Không tìm thấy phiếu sửa chữa đã nghiệm thu.',
        );
      }

      if (request.cost?.replace(/\.0+$/, '') === cost) return;

      if (request.cost !== dto.previousCost) {
        throw new ConflictException(
          'Chi phí đã thay đổi. Vui lòng mở lại phiếu.',
        );
      }

      await tx
        .update(repairRequests)
        .set({ repairCost: cost, updatedAt: new Date(), updatedBy: employeeId })
        .where(eq(repairRequests.id, id));

      await tx.insert(changeHistory).values({
        entityType: 'repair_request',
        entityId: id,
        action: 'update_cost',
        oldData: { repairCost: request.cost },
        newData: { repairCost: cost, reason: dto.reason.trim() },
        performedByEmployeeId: employeeId,
      });
    });
  }

  /** Đọc các lần hoàn tất sửa chữa của tài sản */
  async listCostHistory(assetId: string, actor: AuthenticatedEmployee) {
    this.assertItDepartment(actor);

    const { employees, repairRequests, requestApprovals } = schema;

    const attempts = await this.db
      .select({
        id: requestApprovals.id,
        requestId: repairRequests.id,
        status: repairRequests.status,
        confirmation: repairRequests.confirmationStatus,
        acceptedCost: repairRequests.repairCost,
        date: requestApprovals.createdAt,
        // Lấy giá trị JSON dưới dạng chuỗi. Nhật ký cũ nếu thiếu chi phí thì sẽ trả null.
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
      // Chỉ lấy các phiếu sửa chữa đã hoàn tất.
      .where(
        and(
          eq(repairRequests.assetId, assetId),
          eq(requestApprovals.requestType, 'repair'),
          eq(requestApprovals.actionType, 'completed'),
        ),
      )
      // Duyệt phiếu nào mới sẽ đứng trước và dùng ID để thứ tự ổn định nếu cùng thời điểm.
      .orderBy(desc(requestApprovals.createdAt), desc(requestApprovals.id));

    // Gặp một phiếu lần đầu nghĩa là đang ở lần hoàn tất mới nhất của chính phiếu đó.
    const seen = new Set<string>();

    return attempts.map(
      ({ requestId, status, confirmation, acceptedCost, ...attempt }) => {
        const latest = !seen.has(requestId);

        // Những lần cũ hơn của cùng phiếu đã phải sửa lại trước khi có lần hoàn tất mới.
        seen.add(requestId);

        // Chỉ có lần cuối mới có thể khớp với quyết định nghiệm thu đang lưu trên phiếu.
        if (latest && status === 'closed' && confirmation === 'approved') {
          return {
            ...attempt,
            cost: acceptedCost,
            outcome: 'accepted' as const,
          };
        }

        // Ưu tiên phiếu có trạng thái đang chờ trả về
        if (latest && status === 'ready_for_return') {
          return { ...attempt, outcome: 'pending' as const };
        }

        const returned =
          !latest || (status === 'in_progress' && confirmation === 'rejected');

        return {
          ...attempt,
          outcome: returned ? ('returned' as const) : ('recorded' as const),
        };
      },
    );
  }

  private assertItDepartment(actor: AuthenticatedEmployee) {
    if (actor.departmentName !== 'IT') {
      throw new ForbiddenException('Chỉ phòng IT được xem chi phí sửa chữa.');
    }
  }
}
