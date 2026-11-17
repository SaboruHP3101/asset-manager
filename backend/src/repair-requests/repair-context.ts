import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';

type Database = NodePgDatabase<typeof schema>;
type RepairRecord = typeof schema.repairRequests.$inferSelect;

export async function requireStatus(
  db: Database,
  id: string,
  expected?: RepairRecord['status'][],
) {
  const [request] = await db
    .select()
    .from(schema.repairRequests)
    .where(eq(schema.repairRequests.id, id));

  if (!request) {
    throw new NotFoundException(`Không tìm thấy yêu cầu sửa chữa có ID ${id}`);
  }

  // Đọc chi tiết có thể bỏ qua danh sách trạng thái. Thao tác ghi chỉ chạy ở bước hợp lệ.
  if (expected && !expected.includes(request.status)) {
    throw new BadRequestException(
      `Không thể thực hiện ở trạng thái ${request.status}.`,
    );
  }

  return request;
}

export async function loadAsset(db: Database, id: string) {
  const [asset] = await db
    .select({
      id: schema.assets.id,
      assetCode: schema.assets.assetCode,
      name: schema.assets.name,
      status: schema.assets.status,
      currentLocation: schema.assets.currentLocation,
      currentUserId: schema.assets.currentUserId,
      currentWarehouseId: schema.assets.currentWarehouseId,
      managementOwner: schema.assetCategories.managementOwner,
      category: schema.assetCategories.name,
    })
    .from(schema.assets)
    .innerJoin(
      schema.assetCategories,
      eq(schema.assets.assetCategoryId, schema.assetCategories.id),
    )
    .where(eq(schema.assets.id, id));

  // Dừng các bước sửa hoặc bàn giao nếu không còn tìm thấy tài sản liên quan.
  if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');

  return asset;
}

export async function requireOwnedItAsset(
  db: Database,
  assetId: string,
  employeeId: string,
) {
  const asset = await loadAsset(db, assetId);

  if (asset.currentUserId !== employeeId || asset.managementOwner !== 'it') {
    throw new BadRequestException(
      'Chỉ có thể sửa chữa thiết bị điện tử đang được giao cho bạn.',
    );
  }

  return asset;
}

export function allowedActions(
  request: RepairRecord,
  actor: AuthenticatedEmployee,
): WorkflowAction[] {
  const actions: WorkflowAction[] = [];

  // Người báo chỉ sửa hoặc gửi ở bước soạn phiếu.
  if (
    request.reporterId === actor.id &&
    ['draft', 'revision_required'].includes(request.status)
  ) {
    actions.push(WORKFLOW_ACTIONS.repairUpdate, WORKFLOW_ACTIONS.repairSubmit);
  }

  // Quyền duyệt bước đầu đi theo bộ phận ghi trên phiếu.
  if (
    request.status === 'pending_department_head' &&
    actor.isDepartmentHead &&
    actor.departmentId === request.departmentId
  ) {
    actions.push(WORKFLOW_ACTIONS.repairApproveDepartment);
  }

  // Nút duyệt IT chỉ xuất hiện khi phiếu đã qua bộ phận gửi.
  if (request.status === 'pending_it_head' && isItHead(actor)) {
    actions.push(WORKFLOW_ACTIONS.repairApproveIt);
  }

  // Mỗi bên chỉ thấy nút khi phần xác nhận của mình còn chờ.
  if (
    request.status === 'pending_handover_confirmations' &&
    ((request.reporterId === actor.id &&
      request.employeeHandoverDecision === 'pending') ||
      (isItHead(actor) && request.itHandoverDecision === 'pending'))
  ) {
    actions.push(WORKFLOW_ACTIONS.repairConfirmHandover);
  }

  // Khi đang sửa, trưởng IT có thể giao việc hoặc hoàn tất. Kỹ thuật viên chỉ hoàn tất phiếu của mình.
  if (request.status === 'in_progress' && isItHead(actor)) {
    actions.push(
      WORKFLOW_ACTIONS.repairAssign,
      WORKFLOW_ACTIONS.repairComplete,
    );
  } else if (
    request.status === 'in_progress' &&
    actor.departmentName === 'IT' &&
    request.assignedTo === actor.id
  ) {
    actions.push(WORKFLOW_ACTIONS.repairComplete);
  }

  // Chỉ người báo thấy nút nghiệm thu sau khi IT đã báo hoàn tất.
  if (
    request.status === 'ready_for_return' &&
    request.reporterId === actor.id
  ) {
    actions.push(WORKFLOW_ACTIONS.repairConfirmResult);
  }

  return actions;
}

export function canView(request: RepairRecord, actor: AuthenticatedEmployee) {
  return (
    request.reporterId === actor.id ||
    (actor.isDepartmentHead && actor.departmentId === request.departmentId) ||
    actor.departmentName === 'IT'
  );
}

export function assertOwner(
  request: RepairRecord,
  actor: AuthenticatedEmployee,
) {
  if (request.reporterId !== actor.id) {
    throw new ForbiddenException('Chỉ người tạo mới được sửa phiếu.');
  }
}

export function assertItHead(actor: AuthenticatedEmployee) {
  if (!isItHead(actor)) {
    throw new ForbiddenException('Chỉ Trưởng IT được thực hiện thao tác này.');
  }
}

export function isItHead(actor: AuthenticatedEmployee) {
  return actor.isDepartmentHead && actor.departmentName === 'IT';
}

export function handoverSide(
  request: RepairRecord,
  actor: AuthenticatedEmployee,
): 'employee' | 'it' {
  if (
    request.reporterId === actor.id &&
    request.employeeHandoverDecision === 'pending'
  ) {
    return 'employee';
  }

  if (isItHead(actor) && request.itHandoverDecision === 'pending') {
    return 'it';
  }

  // Không cho xác nhận lại hoặc ghi vào phần bàn giao của người khác.
  throw new ForbiddenException('Bạn không có xác nhận bàn giao đang chờ.');
}

export function lockAsset(db: Database, id: string) {
  return db.execute(sql`select id from assets where id = ${id} for update`);
}

export async function loadLockedRequest(
  db: Database,
  id: string,
  expected: RepairRecord['status'][],
) {
  await db.execute(
    sql`select id from repair_requests where id = ${id} for update`,
  );

  return requireStatus(db, id, expected);
}

export function logAction(
  audit: RequestAuditService,
  db: Database,
  request: RepairRecord,
  actor: AuthenticatedEmployee,
  entry: {
    actionType: string;
    result: 'approved' | 'rejected' | 'pending';
    newStatus?: RepairRecord['status'];
    reason?: string;
    revision?: number;
  }, // Lần gửi lại truyền phiên bản mới vào đây.
) {
  const {
    actionType,
    result: status,
    newStatus = request.status,
    reason,
    revision = request.currentRevision,
  } = entry;

  // Dùng giao dịch của hàm gọi để nhật ký chỉ tồn tại nếu cập nhật phiếu thành công.
  return audit.log(db, {
    requestType: 'repair',
    requestId: request.id,
    workflowRevision: revision,
    actionType,
    approvedBy: actor.id,
    approverRole: actor.departmentName,
    actorDepartmentId: actor.departmentId,
    actorIsDepartmentHead: actor.isDepartmentHead,
    status,
    previousStatus: request.status,
    newStatus,
    reason,
    notes: reason,
  });
}
