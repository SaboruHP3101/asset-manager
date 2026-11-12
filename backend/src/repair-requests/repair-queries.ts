import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, or, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { RepairRequest } from './entities/repair-request.entity.js';
import {
  allowedActions,
  assertItHead,
  canView,
  isItHead,
  loadAsset,
  requireOwnedItAsset,
  requireStatus,
} from './repair-context.js';

type Database = NodePgDatabase<typeof schema>;
export async function findQueue(db: Database, actor: AuthenticatedEmployee) {
  const conditions = [];

  // Trưởng bộ phận chỉ duyệt ở bước đầu và trong bộ phận mình.
  if (actor.isDepartmentHead) {
    conditions.push(
      and(
        eq(schema.repairRequests.status, 'pending_department_head'),
        eq(schema.repairRequests.departmentId, actor.departmentId),
      )!,
    );
  }

  // Trưởng IT xử lý cả duyệt, bàn giao phía IT và phân công hoặc hoàn tất sửa chữa.
  if (isItHead(actor)) {
    conditions.push(eq(schema.repairRequests.status, 'pending_it_head'));
    conditions.push(
      and(
        eq(schema.repairRequests.status, 'pending_handover_confirmations'),
        eq(schema.repairRequests.itHandoverDecision, 'pending'),
      )!,
    );
    conditions.push(eq(schema.repairRequests.status, 'in_progress'));
  } else if (actor.departmentName === 'IT') {
    // Kỹ thuật viên chỉ nhận việc đang sửa đã giao cho mình.
    conditions.push(
      and(
        eq(schema.repairRequests.status, 'in_progress'),
        eq(schema.repairRequests.assignedTo, actor.id),
      )!,
    );
  }

  conditions.push(
    and(
      eq(schema.repairRequests.reporterId, actor.id),
      or(
        and(
          eq(schema.repairRequests.status, 'pending_handover_confirmations'),
          eq(schema.repairRequests.employeeHandoverDecision, 'pending'),
        ),
        eq(schema.repairRequests.status, 'ready_for_return'),
      ),
    )!,
  );

  return findSummaries(db, or(...conditions)!);
}

export async function findItAssignees(
  db: Database,
  actor: AuthenticatedEmployee,
) {
  assertItHead(actor);

  // Chỉ hiện nhân viên IT còn hoạt động, xếp theo tên để dễ tìm trong danh sách.
  return db
    .select({
      id: schema.employees.id,
      name: schema.employees.fullName,
      email: schema.employees.email,
    })
    .from(schema.employees)
    .innerJoin(
      schema.departments,
      eq(schema.employees.departmentId, schema.departments.id),
    )
    .where(
      and(
        eq(schema.departments.name, 'IT'),
        eq(schema.employees.isActive, true),
      ),
    )
    .orderBy(asc(schema.employees.fullName));
}

export async function findOneForActor(
  audit: RequestAuditService,
  db: Database,
  id: string,
  actor: AuthenticatedEmployee,
) {
  const request = await requireStatus(db, id);

  // Kiểm tra quyền trước khi đọc thông tin tài sản và nhật ký đi kèm.
  if (!canView(request, actor)) {
    throw new ForbiddenException('Bạn không được xem phiếu sửa chữa này.');
  }

  // Hai truy vấn độc lập nên có thể chạy song song.
  const [asset, trail] = await Promise.all([
    loadAsset(db, request.assetId),
    audit.findTrail('repair', id),
  ]);

  return {
    ...request,
    asset,
    timeline: trail,
    allowedActions: allowedActions(request, actor),
  };
}

export async function findMyLatestByAsset(
  audit: RequestAuditService,
  db: Database,
  actor: AuthenticatedEmployee,
  assetId: string,
) {
  const [request] = await db
    .select()
    .from(schema.repairRequests)
    .where(
      and(
        eq(schema.repairRequests.assetId, assetId),
        eq(schema.repairRequests.reporterId, actor.id),
      ),
    )
    // Màn hình tài sản chỉ cần phiếu mới nhất của người báo.
    .orderBy(desc(schema.repairRequests.createdAt))
    .limit(1);

  if (!request) {
    // Phân biệt chưa có phiếu với trường hợp tài sản không thuộc phạm vi của người gọi.
    await requireOwnedItAsset(db, assetId, actor.id);

    return null;
  }

  // Dùng cùng dữ liệu chi tiết và quyền thao tác như khi mở phiếu từ danh sách.
  const detail = await findOneForActor(audit, db, request.id, actor);

  return { request: detail, timeline: detail.timeline };
}

export async function findMine(db: Database, employeeId: string) {
  // Chỉ chọn các cột thẻ cần và xếp phiếu mới lên đầu.
  const requests = await db
    .select({
      id: schema.repairRequests.id,
      assetId: schema.repairRequests.assetId,
      assetCode: schema.assets.assetCode,
      assetName: schema.assetCategories.name,
      status: schema.repairRequests.status,
      issueDescription: schema.repairRequests.issueDescription,
      reportDate: schema.repairRequests.reportDate,
      createdAt: schema.repairRequests.createdAt,
    })
    .from(schema.repairRequests)
    .innerJoin(
      schema.assets,
      eq(schema.repairRequests.assetId, schema.assets.id),
    )
    .innerJoin(
      schema.assetCategories,
      eq(schema.assets.assetCategoryId, schema.assetCategories.id),
    )
    .where(eq(schema.repairRequests.reporterId, employeeId))
    .orderBy(desc(schema.repairRequests.createdAt));

  // Bỏ qua truy vấn ảnh khi không có mã tài sản nào để tìm.
  if (requests.length === 0) return [];

  // Lấy ảnh của các tài sản trong một truy vấn để tránh đọc lại theo từng phiếu.
  const attachments = await db
    .select({
      entityId: schema.attachments.entityId,
      url: schema.attachments.url,
    })
    .from(schema.attachments)
    .where(
      and(
        eq(schema.attachments.entityType, 'asset'),
        inArray(
          schema.attachments.entityId,
          requests.map((request) => request.assetId),
        ),
      ),
    )
    .orderBy(asc(schema.attachments.createdAt));
  // Tra ảnh theo ID tài sản vì nhiều phiếu có thể thuộc cùng một tài sản.
  const images = new Map<string, string>();

  for (const attachment of attachments) {
    // Kết quả xếp cũ trước, nên giữ ảnh đầu tiên của mỗi tài sản.
    if (!images.has(attachment.entityId)) {
      images.set(attachment.entityId, attachment.url);
    }
  }

  // Giữ phiếu không có ảnh để client vẫn hiển thị được thẻ và ảnh mặc định.
  return requests.map((request) => ({
    ...request,
    imageUrl: images.get(request.assetId) ?? null,
  }));
}

export async function findMyProgress(
  audit: RequestAuditService,
  db: Database,
  employeeId: string,
  requestId: string,
) {
  // Ràng buộc cả ID phiếu lẫn người báo để biết ID không đủ đọc tiến trình.
  const [request] = await db
    .select()
    .from(schema.repairRequests)
    .where(
      and(
        eq(schema.repairRequests.id, requestId),
        eq(schema.repairRequests.reporterId, employeeId),
      ),
    );

  if (!request) {
    // Trả cùng lỗi cho ID không tồn tại và ID phiếu của người khác.
    throw new NotFoundException('Không tìm thấy yêu cầu sửa chữa.');
  }

  return {
    request: new RepairRequest(request),
    timeline: await audit.findTrail('repair', request.id),
  };
}

export async function findSummaries(db: Database, condition: SQL<unknown>) {
  return (
    db
      .select({
        id: schema.repairRequests.id,
        assetId: schema.repairRequests.assetId,
        assetCode: schema.assets.assetCode,
        assetName: schema.assets.name,
        status: schema.repairRequests.status,
        issueDescription: schema.repairRequests.issueDescription,
        reportDate: schema.repairRequests.reportDate,
        createdAt: schema.repairRequests.createdAt,
      })
      .from(schema.repairRequests)
      .innerJoin(
        schema.assets,
        eq(schema.repairRequests.assetId, schema.assets.id),
      )
      // Lọc ngay trong DB để hàng chờ chỉ trả phiếu khớp vai trò và bước xử lý.
      .where(condition)
      .orderBy(desc(schema.repairRequests.createdAt))
  );
}
