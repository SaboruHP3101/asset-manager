import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { requireActiveItWarehouse } from '../warehouses/warehouses.service.js';
import {
  AssignRepairDto,
  CompleteRepairDto,
  ConfirmRepairDto,
} from './dto/repair-workflow.dto.js';
import { RepairRequest } from './entities/repair-request.entity.js';
import {
  assertItHead,
  isItHead,
  loadAsset,
  loadLockedRequest,
  lockAsset,
  logAction,
  requireOwnedItAsset,
} from './repair-context.js';

type Database = NodePgDatabase<typeof schema>;
type RepairRecord = typeof schema.repairRequests.$inferSelect;
export async function assign(
  audit: RequestAuditService,
  db: Database,
  id: string,
  dto: AssignRepairDto,
  actor: AuthenticatedEmployee,
) {
  assertItHead(actor);

  return db.transaction(async (db) => {
    // Chưa bàn giao xong hoặc đã chờ nghiệm thu thì không phân công tại bước này.
    await loadLockedRequest(db, id, ['in_progress']);

    // Đọc phòng ban và tình trạng tài khoản từ DB, không dựa vào dữ liệu client gửi.
    const [assignee] = await db
      .select({
        id: schema.employees.id,
        isActive: schema.employees.isActive,
        departmentName: schema.departments.name,
      })
      .from(schema.employees)
      .innerJoin(
        schema.departments,
        eq(schema.employees.departmentId, schema.departments.id),
      )
      .where(eq(schema.employees.id, dto.assignedTo));

    // Kiểm tra lại vì danh sách chọn trên màn hình có thể đã cũ.
    if (!assignee || !assignee.isActive || assignee.departmentName !== 'IT') {
      throw new BadRequestException(
        'Chỉ có thể phân công nhân viên IT đang hoạt động.',
      );
    }

    // Người được giao trên phiếu là căn cứ cấp quyền hoàn tất cho kỹ thuật viên.
    const [request] = await db
      .update(schema.repairRequests)
      .set({
        assignedTo: dto.assignedTo,
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.repairRequests.id, id))
      .returning();

    await audit.log(db, {
      requestType: 'repair',
      requestId: id,
      actionType: 'assigned',
      approvedBy: actor.id,
      approverRole: actor.roleName,
      status: 'approved',
      metadata: { assignedTo: dto.assignedTo }, // Phân biệt người giao việc với người nhận việc.
    });

    return new RepairRequest(request);
  });
}

export async function complete(
  audit: RequestAuditService,
  db: Database,
  id: string,
  dto: CompleteRepairDto,
  actor: AuthenticatedEmployee,
) {
  return db.transaction(async (db) => {
    const current = await loadLockedRequest(db, id, ['in_progress']);

    // Trưởng IT có thể hoàn tất. Nhân viên IT phải là người đang được phân công.
    if (
      !isItHead(actor) &&
      (actor.departmentName !== 'IT' || current.assignedTo !== actor.id)
    ) {
      throw new ForbiddenException(
        'Chỉ kỹ thuật viên được phân công hoặc Trưởng IT được hoàn tất.',
      );
    }

    // Lưu kết quả và số tiền của lần này. Phiếu vẫn phải qua nghiệm thu trước khi đóng.
    const [request] = await db
      .update(schema.repairRequests)
      .set({
        status: 'ready_for_return',
        completedAt: new Date(),
        resultNotes: dto.resultNotes,
        repairCost: dto.actualCost,
        updatedAt: new Date(),
      })
      .where(eq(schema.repairRequests.id, id))
      .returning();

    await audit.log(db, {
      requestType: 'repair',
      requestId: id,
      actionType: 'completed',
      approvedBy: actor.id,
      approverRole: actor.roleName,
      status: 'approved', // Ghi nhận bước IT hoàn tất. Nghiệm thu là một sự kiện riêng.
      previousStatus: current.status,
      newStatus: 'ready_for_return',
      // Giữ số tiền của từng lần để xem lại và điền sẵn nếu tài sản bị trả để sửa tiếp.
      metadata: { actualCost: dto.actualCost },
    });

    return new RepairRequest(request);
  });
}

export async function confirmResult(
  audit: RequestAuditService,
  db: Database,
  id: string,
  dto: ConfirmRepairDto,
  actor: AuthenticatedEmployee,
) {
  return db.transaction(async (db) => {
    const current = await loadLockedRequest(db, id, ['ready_for_return']);

    // Người báo hỏng là người nhận lại tài sản và quyết định có chấp nhận kết quả.
    if (current.reporterId !== actor.id) {
      throw new BadRequestException(
        'Chỉ người báo hỏng mới được nghiệm thu kết quả',
      );
    }

    const now = new Date();
    const status = dto.accepted ? 'closed' : 'in_progress';

    // Khóa tài sản để không thao tác trả trên dữ liệu vị trí hoặc người giữ đã đổi.
    await lockAsset(db, current.assetId);
    const warehouse = await requireActiveItWarehouse(db);
    const asset = await loadAsset(db, current.assetId);

    // Chỉ xử lý nghiệm thu nếu tài sản vẫn do kho IT giữ và đang trong luồng sửa.
    if (
      asset.currentWarehouseId !== warehouse.id ||
      asset.currentUserId !== null ||
      asset.status !== 'repairing'
    ) {
      throw new ConflictException('Tài sản không còn ở kho IT.');
    }

    // Chỉ khi được nghiệm thu mới chuyển tài sản về người báo và vị trí trước lúc bàn giao.
    if (dto.accepted) {
      await db
        .update(schema.assets)
        .set({
          status: 'active',
          currentUserId: current.reporterId,
          currentManagingDepartmentId: current.departmentId,
          currentWarehouseId: null,
          currentLocation: current.originalLocation,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.assets.id, asset.id));
      // Lưu lần trả tài sản để lịch sử vị trí khớp với người giữ hiện tại.
      await db.insert(schema.assetHandoverHistory).values({
        assetId: asset.id,
        handoverType: 'repair_returned',
        handoverFromDepartmentId: warehouse.managingDepartmentId,
        handoverFromWarehouseId: warehouse.id,
        receivedByEmployeeId: current.reporterId,
        receivedByDepartmentId: current.departmentId,
        handoverDate: now.toISOString().slice(0, 10),
        status: 'completed',
        note: `Repair request ${current.id}`,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
    }

    // Phiếu bị trả xóa kết quả chờ nghiệm thu. Số tiền lần sửa vẫn còn trong nhật ký.
    const [request] = await db
      .update(schema.repairRequests)
      .set({
        status,
        confirmedBy: actor.id,
        confirmedAt: now,
        confirmationStatus: dto.accepted ? 'approved' : 'rejected',
        closedAt: dto.accepted ? now : null, // Báo cáo tháng dùng ngày đóng phiếu này.
        completedAt: dto.accepted ? current.completedAt : null,
        resultNotes: dto.accepted ? current.resultNotes : null,
        repairCost: dto.accepted ? current.repairCost : null,
        updatedAt: now,
      })
      .where(eq(schema.repairRequests.id, id))
      .returning();

    // Giữ quyết định và lý do để đọc lại kết quả của từng vòng sửa.
    await audit.log(db, {
      requestType: 'repair',
      requestId: id,
      actionType: dto.accepted ? 'confirmed' : 'rejected',
      approvedBy: actor.id,
      approverRole: actor.roleName,
      status: dto.accepted ? 'approved' : 'rejected',
      previousStatus: current.status,
      newStatus: status,
      notes: dto.note,
    });

    return new RepairRequest(request);
  });
}

export async function receiveForRepair(
  audit: RequestAuditService,
  db: Database,
  request: RepairRecord,
  actor: AuthenticatedEmployee,
  now: Date,
) {
  // Người giữ có thể đã đổi trong lúc chờ bàn giao, nên kiểm tra lại sau khi khóa tài sản.
  await lockAsset(db, request.assetId);
  const asset = await requireOwnedItAsset(
    db,
    request.assetId,
    request.reporterId,
  );
  // Kho đang hoạt động cung cấp bộ phận quản lý và vị trí đích.
  const warehouse = await requireActiveItWarehouse(db);

  // Sau khi cả hai bên xác nhận, kho IT thay người báo giữ tài sản trong thời gian sửa.
  await db
    .update(schema.assets)
    .set({
      status: 'repairing',
      currentUserId: null,
      currentManagingDepartmentId: warehouse.managingDepartmentId,
      currentWarehouseId: warehouse.id,
      currentLocation: warehouse.location,
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(eq(schema.assets.id, asset.id));
  // Lưu điểm đi và điểm đến để đối chiếu lần nhập kho với lần trả tài sản.
  await db.insert(schema.assetHandoverHistory).values({
    assetId: asset.id,
    handoverType: 'repair_to_it_warehouse',
    handoverFromEmployeeId: request.reporterId,
    handoverFromDepartmentId: request.departmentId,
    receivedByDepartmentId: warehouse.managingDepartmentId,
    receivedByWarehouseId: warehouse.id,
    handoverDate: now.toISOString().slice(0, 10),
    status: 'completed',
    note: `Repair request ${request.id}`,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  // Chỉ đưa phiếu vào hàng chờ sửa khi đã ghi nhận tài sản vào kho.
  await db
    .update(schema.repairRequests)
    .set({ status: 'in_progress', updatedAt: now, updatedBy: actor.id })
    .where(eq(schema.repairRequests.id, request.id));
  // Timeline dùng sự kiện nhận tài sản để phân biệt nhập kho với xác nhận của từng bên.
  await logAction(audit, db, request, actor, {
    actionType: 'repair.received',
    result: 'approved',
    newStatus: 'in_progress',
  });
}
