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

import { assets, inventory, handovers } from './chat-asset-queries.js';

import {
  repairs,
  requests,
  orders,
  depreciation,
} from './chat-workflow-queries.js';

@Injectable()
export class ChatQueryService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof s>) {}

  async read(
    query: ChatQueryDto,
    actor: AuthenticatedEmployee,
  ): Promise<ChatRecord[]> {
    switch (query.domain) {
      case 'assets':
        return assets(this.db, query, actor);
      case 'warehouse':
        return assets(this.db, query, actor, true);
      case 'repairs':
        return repairs(this.db, query, actor);
      case 'purchase_requests':
        return requests(this.db, query, actor);
      case 'purchase_orders':
        return orders(this.db, query, actor);
      case 'inventory':
        return inventory(this.db, query, actor);
      case 'handovers':
        return handovers(this.db, query, actor);
      case 'depreciation':
        return depreciation(this.db, query, actor);
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
export {
  assetReadScope,
  repairReadScope,
  purchaseReadScope,
} from './chat-query-scope.js';
