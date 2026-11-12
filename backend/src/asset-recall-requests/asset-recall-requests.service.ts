import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  CompleteDisposalDto,
  CompleteUpgradeDto,
  CreateAssetRecallRequestDto,
  ItRecallDecisionDto,
  RecallDecisionDto,
  RecallHandoverDecisionDto,
  UpdateAssetRecallRequestDto,
} from './dto/asset-recall-request.dto.js';
import {
  completeDisposal,
  completeUpgrade,
  decideUpgradeReturn,
} from './recall-completion.js';
import {
  assertItHead,
  assertNoActiveRequest,
  assertOwner,
  lockAsset,
  lockRequest,
  logAction,
  requireExchangeCandidate,
  requireOwnedItAsset,
  requireRequest,
} from './recall-context.js';
import { decideHandover } from './recall-handover.js';
import {
  findExchangeCandidates,
  findMine,
  findOne,
  findQueue,
} from './recall-queries.js';

type Database = NodePgDatabase<typeof schema>;
@Injectable()
export class AssetRecallRequestsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: RequestAuditService,
  ) {}
  findMine(actor: AuthenticatedEmployee) {
    return findMine(this.db, actor);
  }

  findQueue(actor: AuthenticatedEmployee) {
    return findQueue(this.db, actor);
  }

  findOne(id: string, actor: AuthenticatedEmployee) {
    return findOne(this.audit, this.db, id, actor);
  }

  findExchangeCandidates(actor: AuthenticatedEmployee) {
    return findExchangeCandidates(this.db, actor);
  }

  async decideHandover(
    id: string,
    dto: RecallHandoverDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await decideHandover(this.audit, this.db, id, dto, actor);

    return this.findOne(id, actor);
  }

  async completeUpgrade(
    id: string,
    dto: CompleteUpgradeDto,
    actor: AuthenticatedEmployee,
  ) {
    await completeUpgrade(this.audit, this.db, id, dto, actor);

    return this.findOne(id, actor);
  }

  async decideUpgradeReturn(
    id: string,
    dto: RecallHandoverDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await decideUpgradeReturn(this.audit, this.db, id, dto, actor);

    return this.findOne(id, actor);
  }

  async completeDisposal(
    id: string,
    dto: CompleteDisposalDto,
    actor: AuthenticatedEmployee,
  ) {
    await completeDisposal(this.audit, this.db, id, dto, actor);

    return this.findOne(id, actor);
  }
  async create(dto: CreateAssetRecallRequestDto, actor: AuthenticatedEmployee) {
    const requestId = await this.db.transaction(async (tx) => {
      // Lock (giữ) tài sản để hai request không cùng tạo trên một tài sản
      await lockAsset(tx, dto.assetId);
      const asset = await requireOwnedItAsset(tx, dto.assetId, actor.id);

      await assertNoActiveRequest(tx, dto.assetId);
      const [request] = await tx
        .insert(schema.assetRecallRequests)
        .values({
          type: dto.type ?? 'exchange',
          assetId: dto.assetId,
          requestedBy: actor.id,
          requestingDepartmentId: actor.departmentId,
          originalLocation: asset.currentLocation,
          reason: dto.reason?.trim() || null,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({ id: schema.assetRecallRequests.id });

      await logAction(this.audit, tx, request.id, actor, {
        actionType: 'asset.recall.draft_created',
        result: 'pending',
        previousStatus: 'draft',
        newStatus: 'draft',
      });

      return request.id;
    });

    return this.findOne(requestId, actor);
  }

  async update(
    id: string,
    dto: UpdateAssetRecallRequestDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (tx) => {
      await lockRequest(tx, id);
      const request = await requireRequest(tx, id, [
        'draft',
        'revision_required',
      ]);

      assertOwner(request, actor);
      await tx
        .update(schema.assetRecallRequests)
        .set({
          reason: dto.reason?.trim() || null,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(schema.assetRecallRequests.id, id));
      await logAction(this.audit, tx, id, actor, {
        actionType: 'asset.recall.draft_updated',
        result: 'pending',
        previousStatus: request.status,
        newStatus: request.status,
      });
    });

    return this.findOne(id, actor);
  }

  async submit(id: string, actor: AuthenticatedEmployee) {
    await this.db.transaction(async (tx) => {
      await lockRequest(tx, id);
      const request = await requireRequest(tx, id, [
        'draft',
        'revision_required',
      ]);

      assertOwner(request, actor);
      const reason = request.reason?.trim();

      if (!reason) {
        throw new BadRequestException('Vui lòng nhập lý do thu hồi tài sản.');
      }

      await lockAsset(tx, request.assetId);
      await requireOwnedItAsset(tx, request.assetId, actor.id);
      const now = new Date();
      const revision =
        request.status === 'revision_required'
          ? request.currentRevision + 1
          : request.currentRevision;

      await tx
        .update(schema.assetRecallRequests)
        .set({
          status: 'pending_department_head',
          currentRevision: revision,
          departmentHeadDecision: 'pending',
          departmentHeadDecidedBy: null,
          departmentHeadDecidedAt: null,
          departmentHeadNote: null,
          itHeadDecision: 'pending',
          itHeadDecidedBy: null,
          itHeadDecidedAt: null,
          itHeadNote: null,
          employeeHandoverDecision: 'pending',
          employeeHandoverDecidedAt: null,
          employeeHandoverNote: null,
          itHandoverDecision: 'pending',
          itHandoverDecidedBy: null,
          itHandoverDecidedAt: null,
          itHandoverNote: null,
          replacementAssetId: null,
          submittedAt: now,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.assetRecallRequests.id, id));
      await logAction(this.audit, tx, id, actor, {
        actionType: 'asset.recall.submitted',
        result: 'pending',
        previousStatus: request.status,
        newStatus: 'pending_department_head',
        revision,
      });
    });

    return this.findOne(id, actor);
  }

  async decideDepartment(
    id: string,
    dto: RecallDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (tx) => {
      await lockRequest(tx, id);
      const request = await requireRequest(tx, id, ['pending_department_head']);

      if (
        !actor.isDepartmentHead ||
        actor.departmentId !== request.requestingDepartmentId
      ) {
        throw new ForbiddenException(
          'Bạn không được duyệt phiếu của bộ phận khác.',
        );
      }

      const now = new Date();
      const status = dto.approved ? 'pending_it_head' : 'revision_required';

      await tx
        .update(schema.assetRecallRequests)
        .set({
          status,
          departmentHeadDecision: dto.approved ? 'confirmed' : 'rejected',
          departmentHeadDecidedBy: actor.id,
          departmentHeadDecidedAt: now,
          departmentHeadNote: dto.reason?.trim() || null,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.assetRecallRequests.id, id));
      await logAction(this.audit, tx, id, actor, {
        actionType: 'asset.recall.department_decision',
        result: dto.approved ? 'approved' : 'rejected',
        previousStatus: request.status,
        newStatus: status,
        reason: dto.reason,
        revision: request.currentRevision,
      });
    });

    return this.findOne(id, actor);
  }

  async decideIt(
    id: string,
    dto: ItRecallDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    assertItHead(actor);
    await this.db.transaction(async (tx) => {
      await lockRequest(tx, id);
      const request = await requireRequest(tx, id, ['pending_it_head']);
      const now = new Date();
      let replacementAssetId: string | null = null;

      if (dto.approved && request.type === 'exchange') {
        if (!dto.replacementAssetId) {
          throw new BadRequestException('Vui lòng chọn tài sản thay thế.');
        }

        await lockAsset(tx, dto.replacementAssetId);
        await requireExchangeCandidate(
          tx,
          dto.replacementAssetId,
          request.assetId,
        );
        await tx
          .update(schema.assets)
          .set({
            status: 'reserved_for_exchange',
            updatedAt: now,
            updatedBy: actor.id,
          })
          .where(eq(schema.assets.id, dto.replacementAssetId));
        replacementAssetId = dto.replacementAssetId;
      }

      const status = dto.approved
        ? 'pending_handover_confirmations'
        : 'revision_required';

      await tx
        .update(schema.assetRecallRequests)
        .set({
          status,
          replacementAssetId,
          itHeadDecision: dto.approved ? 'confirmed' : 'rejected',
          itHeadDecidedBy: actor.id,
          itHeadDecidedAt: now,
          itHeadNote: dto.reason?.trim() || null,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.assetRecallRequests.id, id));
      await logAction(this.audit, tx, id, actor, {
        actionType: 'asset.recall.it_decision',
        result: dto.approved ? 'approved' : 'rejected',
        previousStatus: request.status,
        newStatus: status,
        reason: dto.reason,
        revision: request.currentRevision,
        metadata: replacementAssetId ? { replacementAssetId } : undefined,
      });
    });

    return this.findOne(id, actor);
  }
}
