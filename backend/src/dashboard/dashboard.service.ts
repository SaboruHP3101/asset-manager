import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, notInArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AssetAllocationsService } from '../asset-allocations/asset-allocations.service.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
} from '../auth/workflow-actions.config.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service.js';
import { PurchaseReceiptsService } from '../purchase-receipts/purchase-receipts.service.js';
import { PurchaseRequestsService } from '../purchase-requests/purchase-requests.service.js';

@Injectable()
/** Tổng hợp dữ liệu ngắn gọn cho Home, tránh tải toàn bộ bản ghi về mobile để đếm. */
export class DashboardService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly purchaseRequests: PurchaseRequestsService,
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly purchaseReceipts: PurchaseReceiptsService,
    private readonly assetAllocations: AssetAllocationsService,
  ) {}

  /**
   * Đếm dữ liệu cá nhân và tái sử dụng các queue đã kiểm tra phạm vi để không
   * trả số lượng công việc ngoài quyền của nhân viên.
   */
  async getMySummary(actor: AuthenticatedEmployee) {
    const actions = new Set(
      getAllowedWorkflowActions(
        actor.roleName,
        actor.isDepartmentHead,
        actor.departmentName,
      ),
    );
    const canProcessRequests = [
      WORKFLOW_ACTIONS.purchaseRequestApproveDepartment,
      WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
      WORKFLOW_ACTIONS.purchaseRequestApproveProcurement,
      WORKFLOW_ACTIONS.purchaseRequestApproveIt,
    ].some((action) => actions.has(action));
    const canCreateOrder = actions.has(WORKFLOW_ACTIONS.purchaseOrderCreate);
    const canApproveOrder = actions.has(WORKFLOW_ACTIONS.purchaseOrderApprove);
    const canTrackOrders = [
      WORKFLOW_ACTIONS.purchaseReceiptRecord,
      WORKFLOW_ACTIONS.purchaseReceiptCloseShort,
    ].some((action) => actions.has(action));
    const canInspect = [
      WORKFLOW_ACTIONS.purchaseReceiptInspectIt,
      WORKFLOW_ACTIONS.purchaseReceiptInspectProcurement,
    ].some((action) => actions.has(action));

    const [
      assetsResult,
      purchaseResult,
      transferResult,
      repairResult,
      requestQueue,
      eligibleOrderItems,
      orderApprovalQueue,
      visibleOrders,
      inspectionQueue,
      allocationQueue,
    ] = await Promise.all([
      this.db
        .select({ value: count(schema.assets.id) })
        .from(schema.assets)
        .where(eq(schema.assets.currentUserId, actor.id)),
      this.db
        .select({ value: count(schema.purchaseRequests.id) })
        .from(schema.purchaseRequests)
        .where(
          and(
            eq(schema.purchaseRequests.requesterId, actor.id),
            notInArray(schema.purchaseRequests.status, ['fully_ordered']),
          ),
        ),
      this.db
        .select({ value: count(schema.transferRequests.id) })
        .from(schema.transferRequests)
        .where(
          and(
            eq(schema.transferRequests.initiatedBy, actor.id),
            notInArray(schema.transferRequests.status, [
              'completed',
              'cancelled',
            ]),
          ),
        ),
      this.db
        .select({ value: count(schema.repairRequests.id) })
        .from(schema.repairRequests)
        .where(
          and(
            eq(schema.repairRequests.reporterId, actor.id),
            notInArray(schema.repairRequests.status, ['closed', 'cancelled']),
          ),
        ),
      canProcessRequests
        ? this.purchaseRequests.findQueue(actor)
        : Promise.resolve([]),
      canCreateOrder
        ? this.purchaseOrders.findEligibleRequests(actor)
        : Promise.resolve([]),
      canApproveOrder
        ? this.purchaseOrders.findApprovalQueue(actor)
        : Promise.resolve([]),
      canTrackOrders
        ? this.purchaseOrders.findAll(actor, {})
        : Promise.resolve([]),
      canInspect
        ? this.purchaseReceipts.findInspectionQueue(actor)
        : Promise.resolve([]),
      this.assetAllocations.findQueue(actor),
    ]);
    const ongoingOrders = visibleOrders.filter((order) =>
      ['issued', 'partially_received'].includes(order.status),
    );

    return {
      assignedAssets: assetsResult[0]?.value ?? 0,
      activeRequests:
        (purchaseResult[0]?.value ?? 0) +
        (transferResult[0]?.value ?? 0) +
        (repairResult[0]?.value ?? 0),
      pendingTasks: {
        purchaseRequests: requestQueue.length,
        purchaseOrders:
          eligibleOrderItems.length +
          orderApprovalQueue.length +
          ongoingOrders.length,
        inspections: inspectionQueue.length,
        allocations: allocationQueue.length,
      },
    };
  }
}
