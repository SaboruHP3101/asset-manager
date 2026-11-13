import { purchaseQueueScope } from '../purchase-requests/purchase-request-queries.js';
import { repairQueueScope } from '../repair-requests/repair-queries.js';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
} from '../auth/workflow-actions.config.js';
import * as s from '../db/schema.js';
import {
  CHAT_RECORD_LIMIT,
  filters,
  purchaseReadScope,
  repairReadScope,
} from './chat-query-scope.js';
import { ChatQueryDto, type ChatRecord } from './chat.dto.js';

type Database = NodePgDatabase<typeof s>;

export async function repairs(
  db: Database,
  query: ChatQueryDto,
  actor: AuthenticatedEmployee,
) {
  return db
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
        query.scope === 'queue' ? repairQueueScope(actor) : undefined,
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

export async function requests(
  db: Database,
  query: ChatQueryDto,
  actor: AuthenticatedEmployee,
): Promise<ChatRecord[]> {
  return db
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
    .innerJoin(s.employees, eq(s.purchaseRequests.requesterId, s.employees.id))
    .innerJoin(
      s.purchaseRequestRevisions,
      and(
        eq(s.purchaseRequestRevisions.purchaseRequestId, s.purchaseRequests.id),
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
        query.scope === 'queue' ? purchaseQueueScope(actor) : undefined,
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

export function orders(
  db: Database,
  query: ChatQueryDto,
  actor: AuthenticatedEmployee,
) {
  const scope =
    actor.departmentName === 'PROCUREMENT' && query.scope !== 'mine'
      ? sql`true`
      : or(
          eq(s.purchaseRequests.requesterId, actor.id),
          ...(actor.isDepartmentHead && query.scope !== 'mine'
            ? [eq(s.purchaseRequests.departmentId, actor.departmentId)]
            : []),
        )!;

  return db
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

export async function depreciation(
  db: Database,
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
  const periods = await db
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
