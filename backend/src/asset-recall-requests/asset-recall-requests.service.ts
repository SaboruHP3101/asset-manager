import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  CreateAssetRecallRequestDto,
  ItRecallDecisionDto,
  RecallDecisionDto,
  RecallHandoverDecisionDto,
  UpdateAssetRecallRequestDto,
} from './dto/asset-recall-request.dto.js';

type Database = NodePgDatabase<typeof schema>;
type RecallStatus = (typeof schema.assetRecallStatusEnum.enumValues)[number];
type RecallRecord = typeof schema.assetRecallRequests.$inferSelect;

@Injectable()
export class AssetRecallRequestsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: RequestAuditService,
  ) {}

  async create(dto: CreateAssetRecallRequestDto, actor: AuthenticatedEmployee) {
    const requestId = await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      // Lock (giữ) tài sản để hai request không cùng tạo trên một tài sản
      await this.lockAsset(tx, dto.assetId);
      const asset = await this.requireOwnedItAsset(tx, dto.assetId, actor.id);

      await this.assertNoActiveRequest(tx, dto.assetId);
      const [request] = await tx
        .insert(schema.assetRecallRequests)
        .values({
          assetId: dto.assetId,
          requestedBy: actor.id,
          requestingDepartmentId: actor.departmentId,
          originalLocation: asset.currentLocation,
          reason: dto.reason?.trim() || null,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({ id: schema.assetRecallRequests.id });

      await this.logAction(tx, request.id, actor, {
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
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireRequest(tx, id, [
        'draft',
        'revision_required',
      ]);

      this.assertOwner(request, actor);
      await tx
        .update(schema.assetRecallRequests)
        .set({
          reason: dto.reason?.trim() || null,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(schema.assetRecallRequests.id, id));
      await this.logAction(tx, id, actor, {
        actionType: 'asset.recall.draft_updated',
        result: 'pending',
        previousStatus: request.status,
        newStatus: request.status,
      });
    });

    return this.findOne(id, actor);
  }

  async submit(id: string, actor: AuthenticatedEmployee) {
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireRequest(tx, id, [
        'draft',
        'revision_required',
      ]);

      this.assertOwner(request, actor);
      const reason = request.reason?.trim();

      if (!reason) {
        throw new BadRequestException('Vui lòng nhập lý do đổi tài sản.');
      }

      await this.lockAsset(tx, request.assetId);
      await this.requireOwnedItAsset(tx, request.assetId, actor.id);
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
      await this.logAction(tx, id, actor, {
        actionType: 'asset.recall.submitted',
        result: 'pending',
        previousStatus: request.status,
        newStatus: 'pending_department_head',
        revision,
      });
    });

    return this.findOne(id, actor);
  }

  async findMine(actor: AuthenticatedEmployee) {
    return this.findSummaries(
      eq(schema.assetRecallRequests.requestedBy, actor.id),
    );
  }

  async findQueue(actor: AuthenticatedEmployee) {
    const conditions = [];

    if (actor.isDepartmentHead) {
      conditions.push(
        and(
          eq(schema.assetRecallRequests.status, 'pending_department_head'),
          eq(
            schema.assetRecallRequests.requestingDepartmentId,
            actor.departmentId,
          ),
        )!,
      );
    }

    if (this.isItHead(actor)) {
      conditions.push(eq(schema.assetRecallRequests.status, 'pending_it_head'));
      conditions.push(
        and(
          eq(
            schema.assetRecallRequests.status,
            'pending_handover_confirmations',
          ),
          eq(schema.assetRecallRequests.itHandoverDecision, 'pending'),
        )!,
      );
    }

    conditions.push(
      and(
        eq(schema.assetRecallRequests.requestedBy, actor.id),
        eq(schema.assetRecallRequests.status, 'pending_handover_confirmations'),
        eq(schema.assetRecallRequests.employeeHandoverDecision, 'pending'),
      )!,
    );

    return this.findSummaries(or(...conditions)!);
  }

  async findOne(id: string, actor: AuthenticatedEmployee) {
    const request = await this.requireRequest(this.db, id);

    if (!this.canView(request, actor)) {
      throw new ForbiddenException('Bạn không được xem phiếu thu hồi này.');
    }

    const [asset, requester, department, replacement, trail] =
      await Promise.all([
        this.loadAsset(this.db, request.assetId),
        this.db
          .select({ id: schema.employees.id, name: schema.employees.fullName })
          .from(schema.employees)
          .where(eq(schema.employees.id, request.requestedBy))
          .then((rows) => rows[0]),
        this.db
          .select({ id: schema.departments.id, name: schema.departments.name })
          .from(schema.departments)
          .where(eq(schema.departments.id, request.requestingDepartmentId))
          .then((rows) => rows[0]),
        request.replacementAssetId
          ? this.loadAsset(this.db, request.replacementAssetId)
          : Promise.resolve(null),
        this.audit.findTrail('recall', id),
      ]);

    return {
      ...request,
      asset,
      replacementAsset: replacement,
      requester,
      department,
      trail,
      allowedActions: this.allowedActions(request, actor),
    };
  }

  async findExchangeCandidates(actor: AuthenticatedEmployee) {
    this.assertItHead(actor);
    const warehouse = await this.requireItWarehouse(this.db);

    return this.db
      .select({
        id: schema.assets.id,
        assetCode: schema.assets.assetCode,
        name: schema.assets.name,
        category: schema.assetCategories.name,
        currentValue: schema.assets.currentValue,
      })
      .from(schema.assets)
      .innerJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .where(
        and(
          eq(schema.assets.currentWarehouseId, warehouse.id),
          eq(schema.assets.status, 'available'),
          eq(schema.assetCategories.managementOwner, 'it'),
        ),
      )
      .orderBy(asc(schema.assets.assetCode));
  }

  async decideDepartment(
    id: string,
    dto: RecallDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireRequest(tx, id, [
        'pending_department_head',
      ]);

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
      await this.logAction(tx, id, actor, {
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
    this.assertItHead(actor);
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireRequest(tx, id, ['pending_it_head']);
      const now = new Date();
      let replacementAssetId: string | null = null;

      if (dto.approved) {
        if (!dto.replacementAssetId) {
          throw new BadRequestException('Vui lòng chọn tài sản thay thế.');
        }

        await this.lockAsset(tx, dto.replacementAssetId);
        await this.requireExchangeCandidate(
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
      await this.logAction(tx, id, actor, {
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

  async decideHandover(
    id: string,
    dto: RecallHandoverDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;

      await this.lockRequest(tx, id);
      const request = await this.requireRequest(tx, id, [
        'pending_handover_confirmations',
      ]);
      const side = this.handoverSide(request, actor);
      const now = new Date();

      if (!dto.confirmed) {
        if (request.replacementAssetId) {
          await this.lockAsset(tx, request.replacementAssetId);
          await this.releaseReplacement(
            tx,
            request.replacementAssetId,
            actor.id,
          );
        }

        await tx
          .update(schema.assetRecallRequests)
          .set({
            status: 'revision_required',
            replacementAssetId: null,
            ...(side === 'employee'
              ? {
                  employeeHandoverDecision: 'rejected' as const,
                  employeeHandoverDecidedAt: now,
                  employeeHandoverNote: dto.reason?.trim() || null,
                }
              : {
                  itHandoverDecision: 'rejected' as const,
                  itHandoverDecidedBy: actor.id,
                  itHandoverDecidedAt: now,
                  itHandoverNote: dto.reason?.trim() || null,
                }),
            updatedAt: now,
            updatedBy: actor.id,
          })
          .where(eq(schema.assetRecallRequests.id, id));
        await this.logAction(tx, id, actor, {
          actionType: `asset.recall.${side}_handover_rejected`,
          result: 'rejected',
          previousStatus: request.status,
          newStatus: 'revision_required',
          reason: dto.reason,
          revision: request.currentRevision,
        });

        return;
      }

      const [updated] = await tx
        .update(schema.assetRecallRequests)
        .set({
          ...(side === 'employee'
            ? {
                employeeHandoverDecision: 'confirmed' as const,
                employeeHandoverDecidedAt: now,
                employeeHandoverNote: dto.reason?.trim() || null,
              }
            : {
                itHandoverDecision: 'confirmed' as const,
                itHandoverDecidedBy: actor.id,
                itHandoverDecidedAt: now,
                itHandoverNote: dto.reason?.trim() || null,
              }),
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(schema.assetRecallRequests.id, id))
        .returning();

      await this.logAction(tx, id, actor, {
        actionType: `asset.recall.${side}_handover_confirmed`,
        result: 'approved',
        previousStatus: request.status,
        newStatus: request.status,
        revision: request.currentRevision,
      });

      if (
        updated.employeeHandoverDecision === 'confirmed' &&
        updated.itHandoverDecision === 'confirmed'
      ) {
        await this.completeExchange(tx, updated, actor, now);
      }
    });

    return this.findOne(id, actor);
  }

  private async completeExchange(
    tx: Database,
    request: RecallRecord,
    actor: AuthenticatedEmployee,
    now: Date,
  ) {
    if (!request.replacementAssetId) {
      throw new BadRequestException('Phiếu chưa có tài sản thay thế.');
    }

    await this.lockAsset(tx, request.assetId);
    await this.lockAsset(tx, request.replacementAssetId);
    const warehouse = await this.requireItWarehouse(tx);
    const original = await this.requireOwnedItAsset(
      tx,
      request.assetId,
      request.requestedBy,
    );
    const replacement = await this.requireReservedReplacement(
      tx,
      request.replacementAssetId,
      warehouse.id,
    );

    await tx
      .update(schema.assets)
      .set({
        status: 'available',
        currentUserId: null,
        currentManagingDepartmentId: warehouse.managingDepartmentId,
        currentWarehouseId: warehouse.id,
        currentLocation: warehouse.location,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assets.id, original.id));
    await tx
      .update(schema.assets)
      .set({
        status: 'active',
        currentUserId: request.requestedBy,
        currentManagingDepartmentId: request.requestingDepartmentId,
        currentWarehouseId: null,
        currentLocation: request.originalLocation,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assets.id, replacement.id));
    await tx.insert(schema.assetHandoverHistory).values([
      {
        assetId: original.id,
        handoverType: 'recall_to_it_warehouse',
        handoverFromEmployeeId: request.requestedBy,
        handoverFromDepartmentId: request.requestingDepartmentId,
        receivedByDepartmentId: warehouse.managingDepartmentId,
        receivedByWarehouseId: warehouse.id,
        handoverDate: now.toISOString().slice(0, 10),
        status: 'completed',
        note: `Recall request ${request.id}`,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
      {
        assetId: replacement.id,
        handoverType: 'exchange_issued',
        handoverFromDepartmentId: warehouse.managingDepartmentId,
        handoverFromWarehouseId: warehouse.id,
        receivedByEmployeeId: request.requestedBy,
        receivedByDepartmentId: request.requestingDepartmentId,
        handoverDate: now.toISOString().slice(0, 10),
        status: 'completed',
        note: `Recall request ${request.id}`,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    ]);
    await tx
      .update(schema.assetRecallRequests)
      .set({
        status: 'completed',
        completedAt: now,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.assetRecallRequests.id, request.id));
    await this.logAction(tx, request.id, actor, {
      actionType: 'asset.recall.exchange_completed',
      result: 'approved',
      previousStatus: request.status,
      newStatus: 'completed',
      revision: request.currentRevision,
      metadata: { replacementAssetId: replacement.id },
    });
  }

  private async findSummaries(condition: ReturnType<typeof eq>) {
    return this.db
      .select({
        id: schema.assetRecallRequests.id,
        type: schema.assetRecallRequests.type,
        status: schema.assetRecallRequests.status,
        currentRevision: schema.assetRecallRequests.currentRevision,
        reason: schema.assetRecallRequests.reason,
        assetId: schema.assets.id,
        assetCode: schema.assets.assetCode,
        assetName: schema.assets.name,
        requestedBy: schema.assetRecallRequests.requestedBy,
        requesterName: schema.employees.fullName,
        departmentName: schema.departments.name,
        createdAt: schema.assetRecallRequests.createdAt,
        updatedAt: schema.assetRecallRequests.updatedAt,
      })
      .from(schema.assetRecallRequests)
      .innerJoin(
        schema.assets,
        eq(schema.assetRecallRequests.assetId, schema.assets.id),
      )
      .innerJoin(
        schema.employees,
        eq(schema.assetRecallRequests.requestedBy, schema.employees.id),
      )
      .innerJoin(
        schema.departments,
        eq(
          schema.assetRecallRequests.requestingDepartmentId,
          schema.departments.id,
        ),
      )
      .where(condition)
      .orderBy(asc(schema.assetRecallRequests.createdAt));
  }

  private async requireRequest(
    db: Database,
    id: string,
    statuses?: RecallStatus[],
  ) {
    const [request] = await db
      .select()
      .from(schema.assetRecallRequests)
      .where(eq(schema.assetRecallRequests.id, id));

    if (!request) throw new NotFoundException('Không tìm thấy phiếu thu hồi.');

    if (statuses && !statuses.includes(request.status)) {
      throw new BadRequestException(
        `Không thể thực hiện ở trạng thái ${request.status}.`,
      );
    }

    return request;
  }

  private async loadAsset(db: Database, id: string) {
    const [asset] = await db
      .select({
        id: schema.assets.id,
        assetCode: schema.assets.assetCode,
        name: schema.assets.name,
        status: schema.assets.status,
        currentValue: schema.assets.currentValue,
        currentLocation: schema.assets.currentLocation,
        currentUserId: schema.assets.currentUserId,
        currentWarehouseId: schema.assets.currentWarehouseId,
        managementOwner: schema.assetCategories.managementOwner,
        category: schema.assetCategories.name,
      })
      .from(schema.assets)
      .innerJoin(
        schema.assetCategories,
        eq(schema.assets.assetCategoryId, schema.assetCategories.id),
      )
      .where(eq(schema.assets.id, id));

    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');

    return asset;
  }

  private async requireOwnedItAsset(
    db: Database,
    assetId: string,
    employeeId: string,
  ) {
    const asset = await this.loadAsset(db, assetId);

    if (asset.currentUserId !== employeeId || asset.managementOwner !== 'it') {
      throw new BadRequestException(
        'Chỉ có thể đổi thiết bị điện tử đang được giao cho bạn.',
      );
    }

    return asset;
  }

  private async assertNoActiveRequest(db: Database, assetId: string) {
    const [active] = await db
      .select({ id: schema.assetRecallRequests.id })
      .from(schema.assetRecallRequests)
      .where(
        and(
          eq(schema.assetRecallRequests.assetId, assetId),
          inArray(schema.assetRecallRequests.status, [
            'draft',
            'pending_department_head',
            'pending_it_head',
            'revision_required',
            'pending_handover_confirmations',
            'in_progress',
            'ready_for_return',
          ]),
        ),
      );

    if (active) {
      throw new ConflictException('Tài sản đã có phiếu thu hồi chưa hoàn tất.');
    }
  }

  private async requireExchangeCandidate(
    db: Database,
    replacementAssetId: string,
    originalAssetId: string,
  ) {
    if (replacementAssetId === originalAssetId) {
      throw new BadRequestException(
        'Tài sản thay thế phải khác tài sản thu hồi.',
      );
    }

    const warehouse = await this.requireItWarehouse(db);
    const candidate = await this.loadAsset(db, replacementAssetId);

    if (
      candidate.managementOwner !== 'it' ||
      candidate.currentWarehouseId !== warehouse.id ||
      candidate.currentUserId !== null ||
      candidate.status !== 'available'
    ) {
      throw new ConflictException(
        'Tài sản thay thế không còn sẵn sàng trong kho IT.',
      );
    }

    return candidate;
  }

  /**
   * Lấy tài sản để
   */
  private async requireReservedReplacement(
    db: Database,
    assetId: string,
    warehouseId: string,
  ) {
    const asset = await this.loadAsset(db, assetId);

    if (
      asset.currentWarehouseId !== warehouseId ||
      asset.currentUserId !== null ||
      asset.status !== 'reserved_for_exchange'
    ) {
      throw new ConflictException('Tài sản thay thế không còn được giữ chỗ.');
    }

    return asset;
  }

  private async releaseReplacement(
    db: Database,
    assetId: string,
    actorId: string,
  ) {
    await db
      .update(schema.assets)
      .set({ status: 'available', updatedAt: new Date(), updatedBy: actorId })
      .where(
        and(
          eq(schema.assets.id, assetId),
          eq(schema.assets.status, 'reserved_for_exchange'),
        ),
      );
  }

  /**
   * Lấy kho IT với mã IT_WAREHOUSE từ bảng warehouses
   */
  private async requireItWarehouse(db: Database) {
    const [warehouse] = await db
      .select()
      .from(schema.warehouses)
      .where(
        and(
          eq(schema.warehouses.code, 'IT_WAREHOUSE'),
          eq(schema.warehouses.isActive, true),
        ),
      );

    if (!warehouse) throw new NotFoundException('Không tìm thấy kho IT.');

    return warehouse;
  }

  /**
   * Kiểm tra xem đúng người tạo phiếu mới được sửa
   */
  private assertOwner(request: RecallRecord, actor: AuthenticatedEmployee) {
    if (request.requestedBy !== actor.id) {
      throw new ForbiddenException('Chỉ người tạo mới được sửa phiếu.');
    }
  }

  private assertItHead(actor: AuthenticatedEmployee) {
    if (!this.isItHead(actor)) {
      throw new ForbiddenException(
        'Chỉ Trưởng IT được thực hiện thao tác này.',
      );
    }
  }

  /**
   * Kiểm tra xem có phải là trưởng IT không
   */
  private isItHead(actor: AuthenticatedEmployee) {
    return actor.isDepartmentHead && actor.departmentName === 'IT';
  }

  /**
   * Kiểm tra xem ai có quyền xem của phiếu, gồm:
   * 1. Người tạo phiếu
   * 2. Trưởng bộ phận của người tạo phiếu
   * 3. Trưởng IT
   */
  private canView(request: RecallRecord, actor: AuthenticatedEmployee) {
    return (
      request.requestedBy === actor.id ||
      (actor.isDepartmentHead &&
        actor.departmentId === request.requestingDepartmentId) ||
      this.isItHead(actor)
    );
  }

  private allowedActions(
    request: RecallRecord,
    actor: AuthenticatedEmployee,
  ): WorkflowAction[] {
    const actions: WorkflowAction[] = [];

    if (
      request.requestedBy === actor.id &&
      ['draft', 'revision_required'].includes(request.status)
    ) {
      actions.push(
        WORKFLOW_ACTIONS.assetRecallUpdate,
        WORKFLOW_ACTIONS.assetRecallSubmit,
      );
    }

    if (
      request.status === 'pending_department_head' &&
      actor.isDepartmentHead &&
      actor.departmentId === request.requestingDepartmentId
    ) {
      actions.push(WORKFLOW_ACTIONS.assetRecallApproveDepartment);
    }

    if (request.status === 'pending_it_head' && this.isItHead(actor)) {
      actions.push(WORKFLOW_ACTIONS.assetRecallApproveIt);
    }

    if (
      request.status === 'pending_handover_confirmations' &&
      ((request.requestedBy === actor.id &&
        request.employeeHandoverDecision === 'pending') ||
        (this.isItHead(actor) && request.itHandoverDecision === 'pending'))
    ) {
      actions.push(WORKFLOW_ACTIONS.assetRecallConfirmHandover);
    }

    return actions;
  }

  private handoverSide(
    request: RecallRecord,
    actor: AuthenticatedEmployee,
  ): 'employee' | 'it' {
    if (
      request.requestedBy === actor.id &&
      request.employeeHandoverDecision === 'pending'
    ) {
      return 'employee';
    }

    if (this.isItHead(actor) && request.itHandoverDecision === 'pending') {
      return 'it';
    }

    throw new ForbiddenException(
      'Bạn không có xác nhận bàn giao đang chờ trên phiếu này.',
    );
  }

  private lockAsset(db: Database, id: string) {
    return db.execute(sql`select id from assets where id = ${id} for update`);
  }

  private lockRequest(db: Database, id: string) {
    return db.execute(
      sql`select id from asset_recall_requests where id = ${id} for update`,
    );
  }

  private logAction(
    db: Database,
    requestId: string,
    actor: AuthenticatedEmployee,
    entry: {
      actionType: string;
      result: 'approved' | 'rejected' | 'pending';
      previousStatus: string;
      newStatus: string;
      reason?: string;
      revision?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.audit.log(db, {
      requestType: 'recall',
      requestId,
      workflowRevision: entry.revision,
      actionType: entry.actionType,
      approvedBy: actor.id,
      approverRole: actor.roleName,
      actorDepartmentId: actor.departmentId,
      actorIsDepartmentHead: actor.isDepartmentHead,
      status: entry.result,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      reason: entry.reason,
      notes: entry.reason,
      metadata: entry.metadata,
    });
  }
}
