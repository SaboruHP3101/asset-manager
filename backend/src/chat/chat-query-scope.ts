import {
  and,
  eq,
  inArray,
  notInArray,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as s from '../db/schema.js';
import { ChatQueryDto } from './chat.dto.js';

export const CHAT_RECORD_LIMIT = 2000;

export const actionModules: Record<string, string> = {
  'purchase.request': 'Đề nghị mua',
  'purchase.order': 'Đơn đặt mua',
  'purchase.receipt': 'Nhận hàng',
  'purchase.allocation': 'Cấp phát',
  'asset.recall': 'Thu hồi tài sản',
  'warehouse.it': 'Kho IT',
  repair: 'Sửa chữa',
  transfer: 'Điều chuyển',
  depreciation: 'Khấu hao',
};

export const actionVerbs: Record<string, string> = {
  create: 'Tạo',
  update: 'Chỉnh sửa',
  submit: 'Gửi',
  delete_draft: 'Xóa nháp',
  approve_department: 'Duyệt tại phòng ban',
  enrich_procurement: 'Bổ sung báo giá',
  approve_procurement: 'Duyệt Thu mua',
  approve_it: 'Duyệt IT',
  approve: 'Duyệt',
  cancel: 'Hủy',
  record: 'Ghi nhận',
  close_short: 'Đóng thiếu',
  inspect_it: 'Kiểm tra IT',
  inspect_procurement: 'Kiểm tra Thu mua',
  create_initial: 'Cấp phát ban đầu',
  reallocate_it: 'Phân bổ lại IT',
  reallocate_procurement: 'Phân bổ lại Thu mua',
  confirm_department: 'Xác nhận phòng ban',
  confirm_recipient: 'Xác nhận nhận tài sản',
  confirm_handover: 'Xác nhận bàn giao',
  process_upgrade: 'Xử lý nâng cấp',
  confirm_upgrade_return: 'Xác nhận nhận lại',
  complete_disposal: 'Hoàn tất báo phế',
  view: 'Xem',
  prepare: 'Chuẩn bị kỳ',
  report: 'Báo hỏng',
  assess: 'Đánh giá',
  assign: 'Phân công',
  complete: 'Hoàn tất',
  confirm_result: 'Xác nhận kết quả',
  confirm: 'Xác nhận',
};

export function assetReadScope(actor: AuthenticatedEmployee): SQL {
  return actor.departmentName === 'IT'
    ? sql`true`
    : eq(s.assets.currentUserId, actor.id);
}

export function repairReadScope(actor: AuthenticatedEmployee): SQL {
  return or(
    eq(s.repairRequests.reporterId, actor.id),
    ...(actor.isDepartmentHead
      ? [eq(s.repairRequests.departmentId, actor.departmentId)]
      : []),
    ...(actor.departmentName === 'IT' ? [sql`true`] : []),
  )!;
}

export function purchaseReadScope(actor: AuthenticatedEmployee): SQL {
  return or(
    eq(s.purchaseRequests.requesterId, actor.id),
    ...(actor.isDepartmentHead
      ? [eq(s.purchaseRequests.departmentId, actor.departmentId)]
      : []),
    ...(actor.departmentName === 'PROCUREMENT'
      ? [
          notInArray(s.purchaseRequests.status, [
            'draft',
            'pending_department_head',
          ]),
        ]
      : []),
    ...(actor.departmentName === 'IT'
      ? [
          and(
            inArray(s.purchaseRequests.status, [
              'pending_it_head',
              'revision_required',
              'approved',
              'ordering',
              'fully_ordered',
            ]),
            sql`exists (
            select 1 from ${s.purchaseRequestItems}
            join ${s.purchaseRequestRevisions}
              on ${s.purchaseRequestItems.requestRevisionId} = ${s.purchaseRequestRevisions.id}
            where ${s.purchaseRequestRevisions.purchaseRequestId} = ${s.purchaseRequests.id}
              and ${s.purchaseRequestRevisions.revisionNumber} = ${s.purchaseRequests.currentRevision}
              and ${s.purchaseRequestItems.managementOwnerSnapshot} = 'it'
          )`,
          )!,
        ]
      : []),
  )!;
}

type FilterColumns = {
  code?: SQLWrapper;
  status?: SQLWrapper;
  date?: SQLWrapper;
  search: SQLWrapper[];
};

export function filters(query: ChatQueryDto, columns: FilterColumns): SQL[] {
  const conditions: SQL[] = [];

  if (query.assetCode && columns.code) {
    conditions.push(
      sql`lower(${columns.code}) = ${query.assetCode.toLowerCase()}`,
    );
  }

  if (query.status && columns.status) {
    const statuses =
      query.status === 'active'
        ? ['active', 'in_use', 'using']
        : [query.status];

    conditions.push(
      sql`${columns.status} in (${sql.join(
        statuses.map((status) => sql`${status}`),
        sql`, `,
      )})`,
    );
  }

  if (query.search) {
    const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;

    conditions.push(
      or(...columns.search.map((column) => sql`${column} ilike ${pattern}`))!,
    );
  }

  if (query.fromDate && columns.date) {
    conditions.push(sql`${columns.date}::date >= ${query.fromDate}::date`);
  }

  if (query.toDate && columns.date) {
    conditions.push(sql`${columns.date}::date <= ${query.toDate}::date`);
  }

  return conditions;
}
