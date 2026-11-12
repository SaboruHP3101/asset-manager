import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  assertDecisionActor,
  assertReallocationActor,
  requireAllocationContext,
  requireAssetContext,
  requireRecipient,
} from './allocation-context.js';
import { applyDecision } from './allocation-decisions.js';
import { notifyPendingConfirmations } from './allocation-notifications.js';
import { findOne, findQueue, findRecipients } from './allocation-queue.js';
import {
  AssetAllocationBatchDecisionDto,
  AssetAllocationDecisionDto,
  CreateAssetAllocationBatchDto,
  CreateAssetAllocationDto,
} from './dto/asset-allocation.dto.js';

type Database = NodePgDatabase<typeof schema>;
type DecisionParty = 'department' | 'recipient';
@Injectable()
export class AssetAllocationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: RequestAuditService,
    private readonly notifications: NotificationsService,
  ) {}
  findQueue(actor: AuthenticatedEmployee) {
    return findQueue(this.db, actor);
  }

  findRecipients(departmentId: string, actor: AuthenticatedEmployee) {
    return findRecipients(this.db, departmentId, actor);
  }

  findOne(id: string, actor: AuthenticatedEmployee) {
    return findOne(this.db, id, actor);
  }
  async create(
    dto: CreateAssetAllocationDto,
    actor: AuthenticatedEmployee,
    reallocation: boolean,
  ) {
    const result = await this.createBatch(
      {
        assetIds: [dto.assetId],
        targetType: dto.targetType,
        recipientId: dto.recipientId,
        departmentId: dto.departmentId,
        location: dto.location,
      },
      actor,
      reallocation,
    );

    return findOne(this.db, result.allocationIds[0], actor);
  }

  async createBatch(
    dto: CreateAssetAllocationBatchDto,
    actor: AuthenticatedEmployee,
    reallocation: boolean,
  ) {
    const allocationIds = await this.db.transaction(async (tx) => {
      const assetIds = [...dto.assetIds].sort();
      const contexts = [];

      for (const assetId of assetIds) {
        await this.lockAsset(tx, assetId);
        contexts.push(await requireAssetContext(tx, assetId));
      }

      if (new Set(contexts.map((asset) => asset.requestId)).size !== 1) {
        throw new BadRequestException(
          'Chỉ có thể cấp phát cùng lúc các tài sản thuộc một đề nghị mua.',
        );
      }

      let recipient: Awaited<ReturnType<typeof requireRecipient>> | null = null;

      if (dto.targetType === 'individual') {
        if (!dto.recipientId) {
          throw new BadRequestException('Vui lòng chọn người nhận.');
        }

        recipient = await requireRecipient(tx, dto.recipientId);

        if (recipient.departmentId !== dto.departmentId) {
          throw new BadRequestException(
            'Người nhận không thuộc phòng ban đã chọn.',
          );
        }
      }

      const ids: string[] = [];

      for (const asset of contexts) {
        ids.push(
          await this.createAllocation(tx, asset, dto, actor, reallocation),
        );
      }

      return ids;
    });

    return { allocationIds, count: allocationIds.length };
  }

  async decide(
    id: string,
    dto: AssetAllocationDecisionDto,
    actor: AuthenticatedEmployee,
    party: DecisionParty,
  ) {
    await this.decideBatch(
      { allocationIds: [id], confirmed: dto.confirmed, reason: dto.reason },
      actor,
      party,
    );

    return findOne(this.db, id, actor);
  }

  async decideBatch(
    dto: AssetAllocationBatchDecisionDto,
    actor: AuthenticatedEmployee,
    party: DecisionParty,
  ) {
    await this.db.transaction(async (tx) => {
      for (const id of [...dto.allocationIds].sort()) {
        await this.lockAllocation(tx, id);
        const allocation = await requireAllocationContext(tx, id);

        if (allocation.allocationStatus !== 'pending_confirmations') {
          throw new ConflictException(
            'Một lần cấp phát đã không còn chờ xác nhận.',
          );
        }

        assertDecisionActor(allocation, actor, party);
        await applyDecision(
          this.audit,
          this.notifications,
          tx,
          allocation,
          dto,
          actor,
          party,
        );
      }
    });

    return { count: dto.allocationIds.length };
  }

  private async createAllocation(
    tx: Database,
    asset: Awaited<ReturnType<typeof requireAssetContext>>,
    dto: CreateAssetAllocationBatchDto,
    actor: AuthenticatedEmployee,
    reallocation: boolean,
  ) {
    const expectedStatus = reallocation
      ? 'awaiting_reallocation'
      : 'awaiting_allocation';

    if (asset.status !== expectedStatus) {
      throw new ConflictException(
        reallocation
          ? 'Một tài sản không ở trạng thái chờ phân bổ lại.'
          : 'Một tài sản không ở trạng thái chờ cấp phát ban đầu.',
      );
    }

    if (reallocation) {
      assertReallocationActor(actor, asset.managementOwner);
    } else if (
      !actor.isDepartmentHead ||
      actor.departmentId !== asset.requestDepartmentId
    ) {
      throw new ForbiddenException(
        'Chỉ Trưởng phòng đề nghị được cấp phát ban đầu.',
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
      .where(eq(schema.assetAllocations.assetId, asset.id))
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

    const recipientId =
      dto.targetType === 'individual' ? dto.recipientId! : null;
    const [allocation] = await tx
      .insert(schema.assetAllocations)
      .values({
        assetId: asset.id,
        attemptNumber: (latest?.attemptNumber ?? 0) + 1,
        initiatedBy: actor.id,
        departmentId: dto.departmentId,
        targetType: dto.targetType,
        recipientId,
        recipientDecision: dto.targetType === 'individual' ? 'pending' : null,
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
      .where(eq(schema.assets.id, asset.id));

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
      metadata: { assetId: asset.id, recipientId, targetType: dto.targetType },
    });
    await notifyPendingConfirmations(
      this.notifications,
      tx,
      allocation.id,
      asset.assetCode,
      dto.departmentId,
      recipientId,
    );

    return allocation.id;
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

export { allocationOutcome } from './allocation-decisions.js';
