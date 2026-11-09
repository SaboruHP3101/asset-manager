import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  and,
  desc,
  eq,
  inArray,
  notInArray,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
} from '../auth/workflow-actions.config.js';
import { PurchaseRequestsService } from '../purchase-requests/purchase-requests.service.js';
import { RepairRequestsService } from '../repair-requests/repair-requests.service.js';
import * as s from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { ChatQueryDto, type ChatRecord } from './chat.dto.js';

const CHAT_RECORD_LIMIT = 2000;

const actionModules: Record<string, string> = {
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
const actionVerbs: Record<string, string> = {
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

/** Mirrors PurchaseAuthorizationService.assertCanViewRequest for set queries. */
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

function filters(query: ChatQueryDto, columns: FilterColumns): SQL[] {
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

@Injectable()
export class ChatQueryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof s>,
    private readonly purchaseRequests: PurchaseRequestsService,
    private readonly repairRequests: RepairRequestsService,
  ) {}

  async read(
    query: ChatQueryDto,
    actor: AuthenticatedEmployee,
  ): Promise<ChatRecord[]> {
    switch (query.domain) {
      case 'assets':
        return this.assets(query, actor);
      case 'warehouse':
        return this.assets(query, actor, true);
      case 'repairs':
        return this.repairs(query, actor);
      case 'purchase_requests':
        return this.requests(query, actor);
      case 'purchase_orders':
        return this.orders(query, actor);
      case 'inventory':
        return this.inventory(query, actor);
      case 'handovers':
        return this.handovers(query, actor);
      case 'depreciation':
        return this.depreciation(query, actor);
      case 'permissions':
        return getAllowedWorkflowActions(
          actor.roleName,
          actor.isDepartmentHead,
          actor.departmentName,
        ).map((action) => {
          const separator = action.lastIndexOf('.');
          const module = action.slice(0, separator);
          const verb = action.slice(separator + 1);

          return {
            id: action,
            name: `${actionModules[module] ?? module}: ${actionVerbs[verb] ?? verb}`,
            action,
          };
        });
      default:
        return [];
    }
  }

  private assets(
    query: ChatQueryDto,
    actor: AuthenticatedEmployee,
    warehouse = false,
  ) {
    if (warehouse && actor.departmentName !== 'IT') {
      throw new ForbiddenException('Bạn không có quyền xem kho IT.');
    }

    const scope =
      query.scope === 'mine' && !warehouse
        ? eq(s.assets.currentUserId, actor.id)
        : assetReadScope(actor);

    return this.db
      .select({
        id: s.assets.id,
        assetCode: s.assets.assetCode,
        name: sql<string>`coalesce(${s.assets.name}, ${s.assetCategories.name})`,
        category: s.assetCategories.name,
        department: s.departments.name,
        assignedTo: s.employees.fullName,
        supplier: s.suppliers.legalName,
        location: sql<
          string | null
        >`coalesce(${s.warehouses.name}, ${s.assets.currentLocation})`,
        status: s.assets.status,
        initialValue: s.assets.initialValue,
        date: s.assets.purchaseDate,
        inServiceDate: s.assets.inServiceDate,
        imageUrl: sql<string | null>`(
        select ${s.attachments.url} from ${s.attachments}
        where ${s.attachments.entityType} = 'asset'
          and ${s.attachments.entityId} = ${s.assets.id}
          and ${s.attachments.mimeType} like 'image/%'
        order by ${s.attachments.createdAt} asc limit 1
      )`,
      })
      .from(s.assets)
      .innerJoin(
        s.assetCategories,
        eq(s.assets.assetCategoryId, s.assetCategories.id),
      )
      .leftJoin(
        s.departments,
        eq(s.assets.currentManagingDepartmentId, s.departments.id),
      )
      .leftJoin(s.employees, eq(s.assets.currentUserId, s.employees.id))
      .leftJoin(s.suppliers, eq(s.assets.supplierId, s.suppliers.id))
      .leftJoin(s.warehouses, eq(s.assets.currentWarehouseId, s.warehouses.id))
      .where(
        and(
          scope,
          ...(warehouse
            ? [
                eq(s.warehouses.code, 'IT_WAREHOUSE'),
                eq(s.warehouses.isActive, true),
              ]
            : []),
          ...filters(query, {
            code: s.assets.assetCode,
            status: s.assets.status,
            date: s.assets.purchaseDate,
            search: [
              s.assets.name,
              s.assets.assetCode,
              s.assetCategories.name,
              s.departments.name,
              s.employees.fullName,
              s.suppliers.legalName,
            ],
          }),
        ),
      )
      .orderBy(s.assets.assetCode)
      .limit(CHAT_RECORD_LIMIT + 1);
  }

  private async repairs(query: ChatQueryDto, actor: AuthenticatedEmployee) {
    const queue =
      query.scope === 'queue'
        ? await this.repairRequests.findQueue(actor)
        : null;

    return this.db
      .select({
        id: s.repairRequests.id,
        assetCode: s.assets.assetCode,
        name: s.assets.name,
        status: s.repairRequests.status,
        description: s.repairRequests.issueDescription,
        repairCost: s.repairRequests.repairCost,
        date: s.repairRequests.reportDate,
        completedAt: s.repairRequests.completedAt,
        department: s.departments.name,
        assignedTo: s.employees.fullName,
      })
      .from(s.repairRequests)
      .innerJoin(s.assets, eq(s.repairRequests.assetId, s.assets.id))
      .leftJoin(
        s.departments,
        eq(s.repairRequests.departmentId, s.departments.id),
      )
      .leftJoin(s.employees, eq(s.repairRequests.assignedTo, s.employees.id))
      .where(
        and(
          query.scope === 'mine'
            ? eq(s.repairRequests.reporterId, actor.id)
            : repairReadScope(actor),
          ...(queue
            ? [
                queue.length
                  ? inArray(
                      s.repairRequests.id,
                      queue.map((item) => item.id),
                    )
                  : sql`false`,
              ]
            : []),
          ...filters(query, {
            code: s.assets.assetCode,
            status: s.repairRequests.status,
            date: s.repairRequests.reportDate,
            search: [
              s.assets.name,
              s.assets.assetCode,
              s.repairRequests.issueDescription,
              s.departments.name,
            ],
          }),
        ),
      )
      .orderBy(desc(s.repairRequests.createdAt))
      .limit(CHAT_RECORD_LIMIT + 1);
  }

  private async requests(
    query: ChatQueryDto,
    actor: AuthenticatedEmployee,
  ): Promise<ChatRecord[]> {
    const queue =
      query.scope === 'queue'
        ? await this.purchaseRequests.findQueue(actor)
        : null;

    return this.db
      .select({
        id: s.purchaseRequests.id,
        code: s.purchaseRequests.requestCode,
        status: s.purchaseRequests.status,
        department: s.departments.name,
        requester: s.employees.fullName,
        date: s.purchaseRequests.createdAt,
        description: s.purchaseRequestRevisions.purpose,
        neededByDate: s.purchaseRequestRevisions.neededByDate,
      })
      .from(s.purchaseRequests)
      .innerJoin(
        s.departments,
        eq(s.purchaseRequests.departmentId, s.departments.id),
      )
      .innerJoin(
        s.employees,
        eq(s.purchaseRequests.requesterId, s.employees.id),
      )
      .innerJoin(
        s.purchaseRequestRevisions,
        and(
          eq(
            s.purchaseRequestRevisions.purchaseRequestId,
            s.purchaseRequests.id,
          ),
          eq(
            s.purchaseRequestRevisions.revisionNumber,
            s.purchaseRequests.currentRevision,
          ),
        ),
      )
      .where(
        and(
          query.scope === 'mine'
            ? eq(s.purchaseRequests.requesterId, actor.id)
            : purchaseReadScope(actor),
          ...(queue
            ? [
                queue.length
                  ? inArray(
                      s.purchaseRequests.id,
                      queue.map((item) => item.id),
                    )
                  : sql`false`,
              ]
            : []),
          ...filters(query, {
            code: s.purchaseRequests.requestCode,
            status: s.purchaseRequests.status,
            date: s.purchaseRequests.createdAt,
            search: [
              s.purchaseRequests.requestCode,
              s.departments.name,
              s.purchaseRequestRevisions.purpose,
            ],
          }),
        ),
      )
      .orderBy(desc(s.purchaseRequests.createdAt))
      .limit(CHAT_RECORD_LIMIT + 1);
  }

  private orders(query: ChatQueryDto, actor: AuthenticatedEmployee) {
    const scope =
      actor.departmentName === 'PROCUREMENT' && query.scope !== 'mine'
        ? sql`true`
        : or(
            eq(s.purchaseRequests.requesterId, actor.id),
            ...(actor.isDepartmentHead && query.scope !== 'mine'
              ? [eq(s.purchaseRequests.departmentId, actor.departmentId)]
              : []),
          )!;

    return this.db
      .select({
        id: s.purchaseOrders.id,
        code: s.purchaseOrders.purchaseOrderCode,
        status: s.purchaseOrders.status,
        supplier: s.suppliers.legalName,
        department: s.departments.name,
        date: s.purchaseOrders.orderDate,
        expectedDeliveryDate: s.purchaseOrders.expectedDeliveryDate,
        totalInclVat: sql<string>`coalesce((select sum(${s.purchaseOrderItems.totalInclVat}) from ${s.purchaseOrderItems} where ${s.purchaseOrderItems.purchaseOrderId} = ${s.purchaseOrders.id}), 0)::text`,
      })
      .from(s.purchaseOrders)
      .innerJoin(
        s.purchaseRequests,
        eq(s.purchaseOrders.purchaseRequestId, s.purchaseRequests.id),
      )
      .innerJoin(
        s.departments,
        eq(s.purchaseRequests.departmentId, s.departments.id),
      )
      .innerJoin(s.suppliers, eq(s.purchaseOrders.supplierId, s.suppliers.id))
      .where(
        and(
          scope,
          purchaseReadScope(actor),
          ...filters(query, {
            code: s.purchaseOrders.purchaseOrderCode,
            status: s.purchaseOrders.status,
            date: s.purchaseOrders.orderDate,
            search: [
              s.purchaseOrders.purchaseOrderCode,
              s.suppliers.legalName,
              s.departments.name,
            ],
          }),
        ),
      )
      .orderBy(desc(s.purchaseOrders.orderDate))
      .limit(CHAT_RECORD_LIMIT + 1);
  }

  private inventory(query: ChatQueryDto, actor: AuthenticatedEmployee) {
    return this.db
      .select({
        id: s.assetInventories.id,
        assetCode: s.assets.assetCode,
        name: s.assets.name,
        status: s.assetInventories.actualStatus,
        date: s.assetInventories.inspectionDate,
        completionDate: s.assetInventories.completionDate,
      })
      .from(s.assetInventories)
      .innerJoin(s.assets, eq(s.assetInventories.assetId, s.assets.id))
      .where(
        and(
          or(
            eq(s.assets.currentUserId, actor.id),
            eq(s.assetInventories.inspectedByEmployeeId, actor.id),
          ),
          ...filters(query, {
            code: s.assets.assetCode,
            status: s.assetInventories.actualStatus,
            date: s.assetInventories.inspectionDate,
            search: [s.assets.name, s.assets.assetCode],
          }),
        ),
      )
      .orderBy(desc(s.assetInventories.inspectionDate))
      .limit(CHAT_RECORD_LIMIT + 1);
  }

  private handovers(query: ChatQueryDto, actor: AuthenticatedEmployee) {
    return this.db
      .select({
        id: s.assetHandoverHistory.id,
        assetCode: s.assets.assetCode,
        name: s.assets.name,
        status: s.assetHandoverHistory.status,
        type: s.assetHandoverHistory.handoverType,
        date: s.assetHandoverHistory.handoverDate,
      })
      .from(s.assetHandoverHistory)
      .innerJoin(s.assets, eq(s.assetHandoverHistory.assetId, s.assets.id))
      .where(
        and(
          eq(s.assets.currentUserId, actor.id),
          ...filters(query, {
            code: s.assets.assetCode,
            status: s.assetHandoverHistory.status,
            date: s.assetHandoverHistory.handoverDate,
            search: [s.assets.name, s.assets.assetCode],
          }),
        ),
      )
      .orderBy(desc(s.assetHandoverHistory.handoverDate))
      .limit(CHAT_RECORD_LIMIT + 1);
  }

  private async depreciation(
    query: ChatQueryDto,
    actor: AuthenticatedEmployee,
  ): Promise<ChatRecord[]> {
    if (
      !getAllowedWorkflowActions(
        actor.roleName,
        actor.isDepartmentHead,
        actor.departmentName,
      ).includes(WORKFLOW_ACTIONS.depreciationView)
    ) {
      throw new ForbiddenException('Bạn không có quyền xem dữ liệu khấu hao.');
    }

    // findAll() also prepares missing periods; a chat read must never call it.
    const periods = await this.db
      .select({
        id: s.depreciationPeriods.id,
        status: s.depreciationPeriods.status,
        date: s.depreciationPeriods.month,
        lines: s.depreciationPeriods.lines,
      })
      .from(s.depreciationPeriods)
      .where(
        and(
          ...filters(
            {
              ...query,
              search: '',
              assetCode: '',
              status: query.status || 'recorded',
            },
            {
              status: s.depreciationPeriods.status,
              date: s.depreciationPeriods.month,
              search: [],
            },
          ),
        ),
      )
      .orderBy(desc(s.depreciationPeriods.month))
      .limit(query.fromDate || query.toDate ? CHAT_RECORD_LIMIT + 1 : 1);

    if (periods.length > CHAT_RECORD_LIMIT) {
      throw new BadRequestException(
        'Vui lòng thu hẹp khoảng thời gian khấu hao.',
      );
    }

    return periods.flatMap((period) =>
      period.lines
        .filter(
          (line) =>
            !query.assetCode ||
            line.assetCode.toLowerCase() === query.assetCode.toLowerCase(),
        )
        .filter(
          (line) =>
            !query.search ||
            `${line.assetCode} ${line.name ?? ''}`
              .toLocaleLowerCase('vi')
              .includes(query.search.toLocaleLowerCase('vi')),
        )
        .map((line) => ({
          id: period.id,
          assetCode: line.assetCode,
          name: line.name,
          status: period.status,
          date: period.date,
          originalCost: line.originalCost,
          openingValue: line.openingValue,
          depreciationAmount: line.depreciationAmount,
          remainingValue: line.remainingValue,
          termMonths: line.termMonths,
          method: 'Đường thẳng',
        })),
    );
  }
}
