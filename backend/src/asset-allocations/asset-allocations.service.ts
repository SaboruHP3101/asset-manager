import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  AssetAllocationDecisionDto,
  CreateAssetAllocationDto,
} from './dto/asset-allocation.dto.js';

type Database = NodePgDatabase<typeof schema>;
type DecisionParty = 'department' | 'recipient';
type ManagementOwner =
  (typeof schema.assetManagementOwnerEnum.enumValues)[number];

export function allocationOutcome(
  departmentDecision: string,
  recipientDecision: string,
): 'pending_confirmations' | 'rejected' | 'confirmed' {
  if (departmentDecision === 'rejected' || recipientDecision === 'rejected') {
    return 'rejected';
  }

  if (departmentDecision === 'confirmed' && recipientDecision === 'confirmed') {
    return 'confirmed';
  }

  return 'pending_confirmations';
}

@Injectable()
export class AssetAllocationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: RequestAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    dto: CreateAssetAllocationDto,
    actor: AuthenticatedEmployee,
    reallocation: boolean,
  ) {
    const allocationId = await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockAsset(tx, dto.assetId);
      const asset = await this.requireAssetContext(tx, dto.assetId);
      const expectedStatus = reallocation
        ? 'awaiting_reallocation'
        : 'awaiting_allocation';

      if (asset.status !== expectedStatus) {
        throw new ConflictException(
          reallocation
            ? 'Tài sản không ở trạng thái chờ phân bổ lại.'
            : 'Tài sản không ở trạng thái chờ cấp phát ban đầu.',
        );
      }

      if (reallocation) {
        this.assertReallocationActor(actor, asset.managementOwner);
      } else if (
        !actor.isDepartmentHead ||
        actor.departmentId !== asset.requestDepartmentId
      ) {
        throw new ForbiddenException(
          'Chỉ Trưởng phòng đề nghị được cấp phát ban đầu.',
        );
      }

      const recipient = await this.requireRecipient(tx, dto.recipientId);

      if (recipient.departmentId !== dto.departmentId) {
        throw new BadRequestException(
          'Người nhận không thuộc phòng ban đã chọn.',
        );
      }

      if (!reallocation && dto.departmentId !== asset.requestDepartmentId) {
        throw new ForbiddenException(
          'Cấp phát ban đầu chỉ dành cho phòng ban đề nghị.',
        );
      }

      const previous = await tx
        .select({
          id: schema.assetAllocations.id,
          attemptNumber: schema.assetAllocations.attemptNumber,
          status: schema.assetAllocations.status,
        })
        .from(schema.assetAllocations)
        .where(eq(schema.assetAllocations.assetId, dto.assetId))
        .orderBy(desc(schema.assetAllocations.attemptNumber))
        .limit(1);
      const latest = previous[0];

      if (reallocation && latest?.status !== 'rejected') {
        throw new ConflictException(
          'Không tìm thấy lần cấp phát bị từ chối để thay thế.',
        );
      }

      const now = new Date();

      if (latest) {
        await tx
          .update(schema.assetAllocations)
          .set({
            status: 'superseded',
            supersededAt: now,
            updatedAt: now,
            updatedBy: actor.id,
          })
          .where(eq(schema.assetAllocations.id, latest.id));
      }

      const [allocation] = await tx
        .insert(schema.assetAllocations)
        .values({
          assetId: dto.assetId,
          attemptNumber: (latest?.attemptNumber ?? 0) + 1,
          initiatedBy: actor.id,
          departmentId: dto.departmentId,
          recipientId: dto.recipientId,
          location: dto.location.trim(),
          managementOwnerSnapshot: asset.managementOwner,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({ id: schema.assetAllocations.id });

      await tx
        .update(schema.assets)
        .set({
          status: 'awaiting_allocation_confirmation',
          currentUserId: null,
          currentManagingDepartmentId: null,
          currentLocation: null,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.assets.id, dto.assetId));

      await this.audit.logPurchase(tx, {
        requestId: asset.requestId,
        revision: asset.requestRevision,
        actionType: reallocation
          ? 'purchase.allocation.reallocate'
          : 'purchase.allocation.create_initial',
        actor,
        result: 'pending',
        previousStatus: asset.status,
        newStatus: 'awaiting_allocation_confirmation',
        entityType: 'allocation',
        entityId: allocation.id,
        metadata: { assetId: dto.assetId, recipientId: dto.recipientId },
      });
      await this.notifyPendingConfirmations(
        tx,
        allocation.id,
        asset.assetCode,
        dto.departmentId,
        dto.recipientId,
      );

      return allocation.id;
    });

    return this.findOne(allocationId, actor);
  }

  async decide(
    id: string,
    dto: AssetAllocationDecisionDto,
    actor: AuthenticatedEmployee,
    party: DecisionParty,
  ) {
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockAllocation(tx, id);
      const allocation = await this.requireAllocationContext(tx, id);

      if (allocation.allocationStatus !== 'pending_confirmations') {
        throw new ConflictException('Lần cấp phát này không còn chờ xác nhận.');
      }

      this.assertDecisionActor(allocation, actor, party);
      const currentDecision =
        party === 'department'
          ? allocation.departmentHeadDecision
          : allocation.recipientDecision;

      if (currentDecision !== 'pending') {
        throw new ConflictException('Bạn đã xác nhận lần cấp phát này.');
      }

      const now = new Date();
      const decision = dto.confirmed ? 'confirmed' : 'rejected';

      await tx
        .update(schema.assetAllocations)
        .set(
          party === 'department'
            ? {
                departmentHeadDecision: decision,
                departmentHeadDecidedBy: actor.id,
                departmentHeadDecidedAt: now,
                departmentHeadNote: dto.reason?.trim() ?? null,
                updatedAt: now,
                updatedBy: actor.id,
              }
            : {
                recipientDecision: decision,
                recipientDecidedAt: now,
                recipientNote: dto.reason?.trim() ?? null,
                updatedAt: now,
                updatedBy: actor.id,
              },
        )
        .where(eq(schema.assetAllocations.id, id));

      const outcome = allocationOutcome(
        party === 'department' ? decision : allocation.departmentHeadDecision,
        party === 'recipient' ? decision : allocation.recipientDecision,
      );

      if (outcome === 'rejected') {
        await this.rejectAllocation(tx, allocation, actor, dto.reason!, now);
      } else if (outcome === 'confirmed') {
        await this.activateAsset(tx, allocation, actor, now);
      } else {
        await this.auditDecision(
          tx,
          allocation,
          actor,
          party,
          'pending_confirmations',
        );
      }
    });

    return this.findOne(id, actor);
  }

  async findQueue(actor: AuthenticatedEmployee) {
    const [assets, allocations] = await Promise.all([
      this.loadAssetQueueCandidates(),
      this.loadAllocationQueueCandidates(),
    ]);
    const actions = this.actionsFor(actor);
    const queue: Record<string, unknown>[] = [];

    if (
      actor.isDepartmentHead &&
      actions.includes(WORKFLOW_ACTIONS.purchaseAllocationCreateInitial)
    ) {
      queue.push(
        ...assets
          .filter(
            (asset) =>
              asset.status === 'awaiting_allocation' &&
              asset.requestDepartmentId === actor.departmentId,
          )
          .map((asset) => ({ ...asset, queueType: 'initial' })),
      );
    }

    queue.push(
      ...allocations
        .filter(
          (item) =>
            item.allocationStatus === 'pending_confirmations' &&
            ((actor.isDepartmentHead &&
              item.departmentId === actor.departmentId &&
              item.departmentHeadDecision === 'pending') ||
              (item.recipientId === actor.id &&
                item.recipientDecision === 'pending')),
        )
        .map((item) => ({
          ...item,
          queueType: 'confirmation',
          decisionParty:
            item.recipientId === actor.id &&
            item.recipientDecision === 'pending'
              ? 'recipient'
              : 'department',
        })),
    );

    queue.push(
      ...assets
        .filter(
          (asset) =>
            asset.status === 'awaiting_reallocation' &&
            this.canReallocate(actor, asset.managementOwner),
        )
        .map((asset) => ({ ...asset, queueType: 'reallocation' })),
    );

    return queue;
  }

  async findRecipients(departmentId: string, actor: AuthenticatedEmployee) {
    const actions = this.actionsFor(actor);
    const canCreateInitial =
      actor.isDepartmentHead &&
      actor.departmentId === departmentId &&
      actions.includes(WORKFLOW_ACTIONS.purchaseAllocationCreateInitial);
    const canReallocate =
      actions.includes(WORKFLOW_ACTIONS.purchaseAllocationReallocateIt) ||
      actions.includes(
        WORKFLOW_ACTIONS.purchaseAllocationReallocateProcurement,
      );

    if (!canCreateInitial && !canReallocate) {
      throw new ForbiddenException('Bạn không có quyền chọn người nhận.');
    }

    return this.db
      .select({
        id: schema.employees.id,
        employeeCode: schema.employees.employeeCode,
        fullName: schema.employees.fullName,
        departmentId: schema.employees.departmentId,
      })
      .from(schema.employees)
      .where(
        and(
          eq(schema.employees.departmentId, departmentId),
          eq(schema.employees.isActive, true),
        ),
      )
      .orderBy(asc(schema.employees.fullName));
  }

  async findOne(id: string, actor: AuthenticatedEmployee) {
    const allocation = await this.requireAllocationContext(this.db, id);

    if (!this.canRead(allocation, actor)) {
      throw new ForbiddenException('Bạn không có quyền xem lần cấp phát này.');
    }

    return allocation;
  }

  private async rejectAllocation(
    tx: Database,
    allocation: Awaited<ReturnType<typeof this.requireAllocationContext>>,
    actor: AuthenticatedEmployee,
    reason: string,
    now: Date,
  ) {
    await tx
      .update(schema.assetAllocations)
      .set({ status: 'rejected', updatedAt: now, updatedBy: actor.id })
      .where(eq(schema.assetAllocations.id, allocation.id));
    await tx
      .update(schema.assets)
      .set({
        status: 'awaiting_reallocation',
        currentUserId: null,
        currentManagingDepartmentId: null,
        currentLocation: null,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assets.id, allocation.assetId));
    await this.auditDecision(
      tx,
      allocation,
      actor,
      'rejected',
      'awaiting_reallocation',
      reason,
    );

    const ownerRecipients = await this.findOwnerRecipients(
      tx,
      allocation.managementOwner,
    );

    await this.notifications.createMany(tx, [
      ...ownerRecipients.map((recipientId) => ({
        recipientId,
        eventType: 'asset_pending_reallocation' as const,
        entityType: 'asset' as const,
        entityId: allocation.assetId,
        title: 'Tài sản chờ phân bổ lại',
        body: `${allocation.assetCode} bị từ chối cấp phát: ${reason}`,
        metadata: { allocationId: allocation.id },
      })),
      ...[...new Set([allocation.initiatedBy, allocation.recipientId])].map(
        (recipientId) => ({
          recipientId,
          eventType: 'asset_allocation_rejected' as const,
          entityType: 'allocation' as const,
          entityId: allocation.id,
          title: 'Cấp phát bị từ chối',
          body: `${allocation.assetCode} bị từ chối cấp phát: ${reason}`,
          metadata: { assetId: allocation.assetId },
        }),
      ),
    ]);
  }

  private async activateAsset(
    tx: Database,
    allocation: Awaited<ReturnType<typeof this.requireAllocationContext>>,
    actor: AuthenticatedEmployee,
    now: Date,
  ) {
    await tx
      .update(schema.assetAllocations)
      .set({ status: 'confirmed', updatedAt: now, updatedBy: actor.id })
      .where(eq(schema.assetAllocations.id, allocation.id));
    await tx
      .update(schema.assets)
      .set({
        status: 'active',
        currentUserId: allocation.recipientId,
        currentManagingDepartmentId: allocation.departmentId,
        currentLocation: allocation.location,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assets.id, allocation.assetId));
    await tx.insert(schema.assetHandoverHistory).values({
      assetId: allocation.assetId,
      handoverType:
        allocation.attemptNumber === 1 ? 'initial_allocation' : 'reallocation',
      receivedByEmployeeId: allocation.recipientId,
      receivedByDepartmentId: allocation.departmentId,
      handoverDate: now.toISOString().slice(0, 10),
      status: 'completed',
      note: `Allocation ${allocation.id}: ${allocation.location}`,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await this.auditDecision(tx, allocation, actor, 'approved', 'active');
    const [ownerRecipients, departmentHeads] = await Promise.all([
      this.findOwnerRecipients(tx, allocation.managementOwner),
      tx
        .select({ id: schema.employees.id })
        .from(schema.employees)
        .where(
          and(
            eq(schema.employees.departmentId, allocation.departmentId),
            eq(schema.employees.isDepartmentHead, true),
            eq(schema.employees.isActive, true),
          ),
        ),
    ]);
    const recipients = [
      ...new Set([
        allocation.recipientId,
        allocation.initiatedBy,
        ...ownerRecipients,
        ...departmentHeads.map((head) => head.id),
      ]),
    ];

    await this.notifications.createMany(
      tx,
      recipients.map((recipientId) => ({
        recipientId,
        eventType: 'asset_activated' as const,
        entityType: 'asset' as const,
        entityId: allocation.assetId,
        title: 'Tài sản đã kích hoạt',
        body: `${allocation.assetCode} đã hoàn tất xác nhận và được kích hoạt.`,
        metadata: { allocationId: allocation.id },
      })),
    );
  }

  private auditDecision(
    tx: Database,
    allocation: Awaited<ReturnType<typeof this.requireAllocationContext>>,
    actor: AuthenticatedEmployee,
    resultOrParty: 'approved' | 'rejected' | DecisionParty,
    newStatus: string,
    reason?: string,
  ) {
    const result = resultOrParty === 'rejected' ? 'rejected' : 'approved';
    const party =
      resultOrParty === 'department' || resultOrParty === 'recipient'
        ? resultOrParty
        : undefined;

    return this.audit.logPurchase(tx, {
      requestId: allocation.requestId,
      revision: allocation.requestRevision,
      actionType: party
        ? `purchase.allocation.confirm_${party}`
        : result === 'rejected'
          ? 'purchase.allocation.reject'
          : 'purchase.allocation.activate',
      actor,
      result,
      previousStatus: allocation.assetStatus,
      newStatus,
      reason,
      entityType: 'allocation',
      entityId: allocation.id,
      metadata: { assetId: allocation.assetId, party },
    });
  }

  private async notifyPendingConfirmations(
    tx: Database,
    allocationId: string,
    assetCode: string,
    departmentId: string,
    recipientId: string,
  ) {
    const heads = await tx
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .where(
        and(
          eq(schema.employees.departmentId, departmentId),
          eq(schema.employees.isDepartmentHead, true),
          eq(schema.employees.isActive, true),
        ),
      );
    const recipients = [
      ...new Set([recipientId, ...heads.map((head) => head.id)]),
    ];

    await this.notifications.createMany(
      tx,
      recipients.map((id) => ({
        recipientId: id,
        eventType: 'asset_allocation_pending_confirmation' as const,
        entityType: 'allocation' as const,
        entityId: allocationId,
        title: 'Cấp phát chờ xác nhận',
        body: `${assetCode} đang chờ xác nhận cấp phát.`,
        metadata: { assetCode },
      })),
    );
  }

  private async loadAssetQueueCandidates() {
    return this.db
      .select({
        assetId: schema.assets.id,
        assetCode: schema.assets.assetCode,
        assetName: schema.assets.name,
        status: schema.assets.status,
        managementOwner: schema.assetCategories.managementOwner,
        requestId: schema.purchaseRequests.id,
        requestCode: schema.purchaseRequests.requestCode,
        requestDepartmentId: schema.purchaseRequests.departmentId,
      })
      .from(schema.assets)
      .innerJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .innerJoin(
        schema.purchaseOrderItems,
        eq(schema.assets.purchaseOrderItemId, schema.purchaseOrderItems.id),
      )
      .innerJoin(
        schema.purchaseRequestItems,
        eq(
          schema.purchaseOrderItems.purchaseRequestItemId,
          schema.purchaseRequestItems.id,
        ),
      )
      .innerJoin(
        schema.purchaseRequestRevisions,
        eq(
          schema.purchaseRequestItems.requestRevisionId,
          schema.purchaseRequestRevisions.id,
        ),
      )
      .innerJoin(
        schema.purchaseRequests,
        eq(
          schema.purchaseRequestRevisions.purchaseRequestId,
          schema.purchaseRequests.id,
        ),
      )
      .where(
        sql`${schema.assets.status} in ('awaiting_allocation', 'awaiting_reallocation')`,
      )
      .orderBy(asc(schema.assets.assetCode));
  }

  private async loadAllocationQueueCandidates() {
    return this.db
      .select({
        allocationId: schema.assetAllocations.id,
        assetId: schema.assets.id,
        assetCode: schema.assets.assetCode,
        assetName: schema.assets.name,
        allocationStatus: schema.assetAllocations.status,
        departmentId: schema.assetAllocations.departmentId,
        recipientId: schema.assetAllocations.recipientId,
        recipientName: schema.employees.fullName,
        location: schema.assetAllocations.location,
        departmentHeadDecision: schema.assetAllocations.departmentHeadDecision,
        recipientDecision: schema.assetAllocations.recipientDecision,
      })
      .from(schema.assetAllocations)
      .innerJoin(
        schema.assets,
        eq(schema.assetAllocations.assetId, schema.assets.id),
      )
      .innerJoin(
        schema.employees,
        eq(schema.assetAllocations.recipientId, schema.employees.id),
      )
      .where(eq(schema.assetAllocations.status, 'pending_confirmations'))
      .orderBy(asc(schema.assets.assetCode));
  }

  private async requireAssetContext(db: Database, assetId: string) {
    const rows = await db
      .select({
        id: schema.assets.id,
        assetCode: schema.assets.assetCode,
        status: schema.assets.status,
        managementOwner: schema.assetCategories.managementOwner,
        requestId: schema.purchaseRequests.id,
        requestRevision: schema.purchaseRequests.currentRevision,
        requestDepartmentId: schema.purchaseRequests.departmentId,
      })
      .from(schema.assets)
      .innerJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .innerJoin(
        schema.purchaseOrderItems,
        eq(schema.assets.purchaseOrderItemId, schema.purchaseOrderItems.id),
      )
      .innerJoin(
        schema.purchaseRequestItems,
        eq(
          schema.purchaseOrderItems.purchaseRequestItemId,
          schema.purchaseRequestItems.id,
        ),
      )
      .innerJoin(
        schema.purchaseRequestRevisions,
        eq(
          schema.purchaseRequestItems.requestRevisionId,
          schema.purchaseRequestRevisions.id,
        ),
      )
      .innerJoin(
        schema.purchaseRequests,
        eq(
          schema.purchaseRequestRevisions.purchaseRequestId,
          schema.purchaseRequests.id,
        ),
      )
      .where(eq(schema.assets.id, assetId));
    const asset = rows[0];

    if (!asset) throw new NotFoundException('Không tìm thấy tài sản mua sắm.');

    return asset;
  }

  private async requireAllocationContext(db: Database, id: string) {
    const rows = await db
      .select({
        id: schema.assetAllocations.id,
        assetId: schema.assetAllocations.assetId,
        attemptNumber: schema.assetAllocations.attemptNumber,
        initiatedBy: schema.assetAllocations.initiatedBy,
        departmentId: schema.assetAllocations.departmentId,
        departmentName: schema.departments.name,
        recipientId: schema.assetAllocations.recipientId,
        recipientName: schema.employees.fullName,
        location: schema.assetAllocations.location,
        managementOwner: schema.assetAllocations.managementOwnerSnapshot,
        allocationStatus: schema.assetAllocations.status,
        departmentHeadDecision: schema.assetAllocations.departmentHeadDecision,
        recipientDecision: schema.assetAllocations.recipientDecision,
        assetCode: schema.assets.assetCode,
        assetName: schema.assets.name,
        assetStatus: schema.assets.status,
        requestId: schema.purchaseRequests.id,
        requestRevision: schema.purchaseRequests.currentRevision,
        requestDepartmentId: schema.purchaseRequests.departmentId,
      })
      .from(schema.assetAllocations)
      .innerJoin(
        schema.assets,
        eq(schema.assetAllocations.assetId, schema.assets.id),
      )
      .innerJoin(
        schema.departments,
        eq(schema.assetAllocations.departmentId, schema.departments.id),
      )
      .innerJoin(
        schema.employees,
        eq(schema.assetAllocations.recipientId, schema.employees.id),
      )
      .innerJoin(
        schema.purchaseOrderItems,
        eq(schema.assets.purchaseOrderItemId, schema.purchaseOrderItems.id),
      )
      .innerJoin(
        schema.purchaseRequestItems,
        eq(
          schema.purchaseOrderItems.purchaseRequestItemId,
          schema.purchaseRequestItems.id,
        ),
      )
      .innerJoin(
        schema.purchaseRequestRevisions,
        eq(
          schema.purchaseRequestItems.requestRevisionId,
          schema.purchaseRequestRevisions.id,
        ),
      )
      .innerJoin(
        schema.purchaseRequests,
        eq(
          schema.purchaseRequestRevisions.purchaseRequestId,
          schema.purchaseRequests.id,
        ),
      )
      .where(eq(schema.assetAllocations.id, id));
    const allocation = rows[0];

    if (!allocation)
      throw new NotFoundException('Không tìm thấy lần cấp phát.');

    return allocation;
  }

  private async requireRecipient(db: Database, id: string) {
    const rows = await db
      .select({
        id: schema.employees.id,
        departmentId: schema.employees.departmentId,
        isActive: schema.employees.isActive,
      })
      .from(schema.employees)
      .where(eq(schema.employees.id, id));
    const recipient = rows[0];

    if (!recipient || !recipient.isActive) {
      throw new BadRequestException(
        'Người nhận không tồn tại hoặc đã ngừng hoạt động.',
      );
    }

    return recipient;
  }

  private async findOwnerRecipients(db: Database, owner: ManagementOwner) {
    const rows = await db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .innerJoin(
        schema.departments,
        eq(schema.employees.departmentId, schema.departments.id),
      )
      .where(
        and(
          eq(schema.departments.name, owner.toUpperCase()),
          eq(schema.employees.isActive, true),
        ),
      );

    return rows.map((row) => row.id);
  }

  private assertDecisionActor(
    allocation: Awaited<ReturnType<typeof this.requireAllocationContext>>,
    actor: AuthenticatedEmployee,
    party: DecisionParty,
  ) {
    if (
      party === 'department' &&
      (!actor.isDepartmentHead ||
        actor.departmentId !== allocation.departmentId)
    ) {
      throw new ForbiddenException(
        'Chỉ Trưởng phòng nhận được xác nhận cấp phát.',
      );
    }

    if (party === 'recipient' && actor.id !== allocation.recipientId) {
      throw new ForbiddenException(
        'Chỉ đúng người nhận được xác nhận cấp phát.',
      );
    }
  }

  private assertReallocationActor(
    actor: AuthenticatedEmployee,
    owner: ManagementOwner,
  ) {
    if (!this.canReallocate(actor, owner)) {
      throw new ForbiddenException(
        owner === 'it'
          ? 'Chỉ nhân viên IT được phân bổ lại tài sản này.'
          : 'Chỉ nhân viên Thu mua được phân bổ lại tài sản này.',
      );
    }
  }

  private canReallocate(actor: AuthenticatedEmployee, owner: ManagementOwner) {
    const action =
      owner === 'it'
        ? WORKFLOW_ACTIONS.purchaseAllocationReallocateIt
        : WORKFLOW_ACTIONS.purchaseAllocationReallocateProcurement;

    return this.actionsFor(actor).includes(action);
  }

  private canRead(
    allocation: Awaited<ReturnType<typeof this.requireAllocationContext>>,
    actor: AuthenticatedEmployee,
  ) {
    return (
      actor.id === allocation.recipientId ||
      actor.id === allocation.initiatedBy ||
      (actor.isDepartmentHead &&
        (actor.departmentId === allocation.departmentId ||
          actor.departmentId === allocation.requestDepartmentId)) ||
      this.canReallocate(actor, allocation.managementOwner)
    );
  }

  private actionsFor(actor: AuthenticatedEmployee): WorkflowAction[] {
    return getAllowedWorkflowActions(
      actor.roleName,
      actor.isDepartmentHead,
      actor.departmentName,
    );
  }

  private lockAsset(db: Database, id: string) {
    return db.execute(sql`select id from assets where id = ${id} for update`);
  }

  private lockAllocation(db: Database, id: string) {
    return db.execute(
      sql`select id from asset_allocations where id = ${id} for update`,
    );
  }
}
