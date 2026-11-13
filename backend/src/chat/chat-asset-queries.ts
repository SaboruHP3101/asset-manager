import { purchaseQueueScope } from '../purchase-requests/purchase-request-queries.js';

import { repairQueueScope } from '../repair-requests/repair-queries.js';

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

type Database = NodePgDatabase<typeof s>;

export function assets(
  db: Database,
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

  return db
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

export function inventory(
  db: Database,
  query: ChatQueryDto,
  actor: AuthenticatedEmployee,
) {
  return db
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

export function handovers(
  db: Database,
  query: ChatQueryDto,
  actor: AuthenticatedEmployee,
) {
  return db
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
import {
  CHAT_RECORD_LIMIT,
  actionModules,
  actionVerbs,
  assetReadScope,
  repairReadScope,
  purchaseReadScope,
  filters,
} from './chat-query-scope.js';
