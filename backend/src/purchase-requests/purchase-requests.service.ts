import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
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
  CreatePurchaseQuoteDto,
  PurchaseRequestDecisionDto,
  SavePurchaseRequestDto,
} from './dto/purchase-request.dto.js';

type Database = NodePgDatabase<typeof schema>;
type PurchaseRequestStatus =
  (typeof schema.purchaseRequestStatusEnum.enumValues)[number];

@Injectable()
export class PurchaseRequestsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly authorization: PurchaseAuthorizationService,
    private readonly audit: RequestAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: SavePurchaseRequestDto, actor: AuthenticatedEmployee) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestCreate,
    );
    const categories = await this.loadCategories(dto);
    const requestId = await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const [request] = await tx
        .insert(schema.purchaseRequests)
        .values({
          requestCode: this.createRequestCode(),
          requesterId: actor.id,
          departmentId: actor.departmentId,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();
      const [revision] = await tx
        .insert(schema.purchaseRequestRevisions)
        .values({
          purchaseRequestId: request.id,
          revisionNumber: 1,
          neededByDate: dto.neededByDate,
          purpose: dto.purpose,
          note: dto.note,
          createdBy: actor.id,
        })
        .returning();
      await this.insertItems(tx, revision.id, dto, categories, actor.id);
      await this.audit.logPurchase(tx, {
        requestId: request.id,
        revision: 1,
        actionType: 'purchase.request.create',
        actor,
        result: 'pending',
        previousStatus: 'draft',
        newStatus: 'draft',
        entityType: 'request',
        entityId: request.id,
      });
      return request.id;
    });

    return this.findOne(requestId, actor);
  }

  async update(
    id: string,
    dto: SavePurchaseRequestDto,
    actor: AuthenticatedEmployee,
  ) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestUpdate,
    );
    const categories = await this.loadCategories(dto);
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const request = await this.requireRequest(tx, id, [
        'draft',
        'revision_required',
      ]);
      this.authorization.assertOwnRequest(actor, request);
      const revision = await this.requireCurrentRevision(tx, request);

      await tx
        .update(schema.purchaseRequestRevisions)
        .set({
          neededByDate: dto.neededByDate,
          purpose: dto.purpose,
          note: dto.note ?? null,
        })
        .where(eq(schema.purchaseRequestRevisions.id, revision.id));
      await tx
        .delete(schema.purchaseRequestItems)
        .where(eq(schema.purchaseRequestItems.requestRevisionId, revision.id));
      await this.insertItems(tx, revision.id, dto, categories, actor.id);
      await tx
        .update(schema.purchaseRequests)
        .set({ updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(schema.purchaseRequests.id, id));
      await this.audit.logPurchase(tx, {
        requestId: id,
        revision: request.currentRevision,
        actionType: 'purchase.request.update',
        actor,
        result: 'pending',
        previousStatus: request.status,
        newStatus: request.status,
        entityType: 'request',
        entityId: id,
      });
    });

    return this.findOne(id, actor);
  }

  async submit(id: string, actor: AuthenticatedEmployee) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestSubmit,
    );
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const request = await this.requireRequest(tx, id, [
        'draft',
        'revision_required',
      ]);
      this.authorization.assertOwnRequest(actor, request);
      const revision = await this.requireCurrentRevision(tx, request);
      const items = await this.loadRevisionItems(tx, revision.id);
      if (items.length === 0) {
        throw new BadRequestException('Đề nghị phải có ít nhất một hạng mục.');
      }

      const now = new Date();
      await tx
        .update(schema.purchaseRequestRevisions)
        .set({ submittedAt: now, submittedBy: actor.id })
        .where(eq(schema.purchaseRequestRevisions.id, revision.id));
      await this.setStatus(tx, id, 'pending_department_head', actor.id);
      await this.audit.logPurchase(tx, {
        requestId: id,
        revision: request.currentRevision,
        actionType: 'purchase.request.submit',
        actor,
        result: 'pending',
        previousStatus: request.status,
        newStatus: 'pending_department_head',
        entityType: 'request',
        entityId: id,
      });
      await this.notifyDepartmentHeads(tx, request.departmentId, {
        eventType: 'purchase_request_submitted',
        requestId: id,
        title: 'Đề nghị mua đang chờ duyệt',
        body: `Đề nghị ${request.requestCode} đang chờ Trưởng phòng xử lý.`,
      });
    });

    return this.findOne(id, actor);
  }

  async decideDepartment(
    id: string,
    dto: PurchaseRequestDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestApproveDepartment,
    );
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const request = await this.requireRequest(tx, id, [
        'pending_department_head',
      ]);
      this.authorization.assertDepartmentRequest(actor, request);
      if (!dto.approved) {
        await this.returnForRevision(tx, request, actor, dto.reason!);
        return;
      }

      await this.setStatus(tx, id, 'pending_procurement_enrichment', actor.id);
      await this.audit.logPurchase(tx, {
        requestId: id,
        revision: request.currentRevision,
        actionType: 'purchase.request.approve_department',
        actor,
        result: 'approved',
        previousStatus: request.status,
        newStatus: 'pending_procurement_enrichment',
        entityType: 'request',
        entityId: id,
      });
      await this.notifyDepartment(tx, 'PROCUREMENT', {
        eventType: 'purchase_request_ready_for_procurement',
        requestId: id,
        title: 'Đề nghị mua cần bổ sung báo giá',
        body: `Đề nghị ${request.requestCode} đã qua duyệt cấp phòng.`,
      });
    });

    return this.findOne(id, actor);
  }

  async addQuote(
    id: string,
    dto: CreatePurchaseQuoteDto,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedEmployee,
  ) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
    );
    this.authorization.assertDepartment(actor, 'PROCUREMENT');
    if (!file) throw new BadRequestException('Ảnh báo giá là bắt buộc.');

    try {
      await this.db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        const request = await this.requireRequest(tx, id, [
          'pending_procurement_enrichment',
        ]);
        const revision = await this.requireCurrentRevision(tx, request);
        const [item] = await tx
          .select({ id: schema.purchaseRequestItems.id })
          .from(schema.purchaseRequestItems)
          .where(
            and(
              eq(schema.purchaseRequestItems.id, dto.requestItemId),
              eq(schema.purchaseRequestItems.requestRevisionId, revision.id),
            ),
          );
        if (!item) {
          throw new BadRequestException(
            'Hạng mục không thuộc revision hiện tại.',
          );
        }
        const [supplier] = await tx
          .select({ id: schema.suppliers.id })
          .from(schema.suppliers)
          .where(eq(schema.suppliers.id, dto.supplierId));
        if (!supplier)
          throw new BadRequestException('Nhà cung cấp không tồn tại.');

        const [existingQuote] = await tx
          .select({ id: schema.purchaseRequestQuotes.id })
          .from(schema.purchaseRequestQuotes)
          .where(
            and(
              eq(schema.purchaseRequestQuotes.requestItemId, item.id),
              eq(schema.purchaseRequestQuotes.supplierId, dto.supplierId),
            ),
          );
        if (existingQuote) {
          throw new ConflictException(
            'Hạng mục đã có báo giá của nhà cung cấp này.',
          );
        }

        if (dto.isSelected) {
          await tx
            .update(schema.purchaseRequestQuotes)
            .set({
              isSelected: false,
              updatedAt: new Date(),
              updatedBy: actor.id,
            })
            .where(eq(schema.purchaseRequestQuotes.requestItemId, item.id));
        }
        const [attachment] = await tx
          .insert(schema.attachments)
          .values({
            entityType: 'purchase_request_item',
            entityId: item.id,
            fileName: file.originalname,
            url: `/uploads/purchase-quotes/${file.filename}`,
            mimeType: file.mimetype,
            size: file.size,
            uploadedByEmployeeId: actor.id,
          })
          .returning();
        await tx.insert(schema.purchaseRequestQuotes).values({
          requestItemId: item.id,
          supplierId: dto.supplierId,
          attachmentId: attachment.id,
          unitPriceExclVat: dto.unitPriceExclVat,
          vatRate: dto.vatRate,
          isSelected: dto.isSelected,
          note: dto.note,
          createdBy: actor.id,
          updatedBy: actor.id,
        });
        await this.audit.logPurchase(tx, {
          requestId: id,
          revision: request.currentRevision,
          actionType: 'purchase.request.add_quote',
          actor,
          result: 'pending',
          previousStatus: request.status,
          newStatus: request.status,
          entityType: 'request',
          entityId: id,
          metadata: { requestItemId: item.id, supplierId: dto.supplierId },
        });
      });
    } catch (error) {
      await unlink(file.path).catch(() => undefined);
      throw error;
    }

    return this.findOne(id, actor);
  }

  async submitProcurement(id: string, actor: AuthenticatedEmployee) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
    );
    this.authorization.assertDepartment(actor, 'PROCUREMENT');
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const request = await this.requireRequest(tx, id, [
        'pending_procurement_enrichment',
      ]);
      await this.requireCommercialData(tx, request);
      await this.setStatus(tx, id, 'pending_procurement_head', actor.id);
      await this.audit.logPurchase(tx, {
        requestId: id,
        revision: request.currentRevision,
        actionType: 'purchase.request.submit_procurement',
        actor,
        result: 'pending',
        previousStatus: request.status,
        newStatus: 'pending_procurement_head',
        entityType: 'request',
        entityId: id,
      });
      await this.notifyDepartmentHeadsByName(tx, 'PROCUREMENT', {
        eventType: 'purchase_request_ready_for_procurement_head',
        requestId: id,
        title: 'Đề nghị mua chờ duyệt thương mại',
        body: `Đề nghị ${request.requestCode} đã đủ thông tin thương mại.`,
      });
    });

    return this.findOne(id, actor);
  }

  async decideProcurement(
    id: string,
    dto: PurchaseRequestDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestApproveProcurement,
    );
    this.authorization.assertDepartment(actor, 'PROCUREMENT');
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const request = await this.requireRequest(tx, id, [
        'pending_procurement_head',
      ]);
      await this.requireCommercialData(tx, request);
      if (!dto.approved) {
        await this.returnForRevision(tx, request, actor, dto.reason!);
        return;
      }

      const revision = await this.requireCurrentRevision(tx, request);
      const items = await this.loadRevisionItems(tx, revision.id);
      const hasItItems = items.some(
        (item) => item.managementOwnerSnapshot === 'it',
      );
      const nextStatus = hasItItems ? 'pending_it_head' : 'approved';
      await this.setStatus(tx, id, nextStatus, actor.id);
      await this.audit.logPurchase(tx, {
        requestId: id,
        revision: request.currentRevision,
        actionType: 'purchase.request.approve_procurement',
        actor,
        result: 'approved',
        previousStatus: request.status,
        newStatus: nextStatus,
        entityType: 'request',
        entityId: id,
      });
      if (hasItItems) {
        await this.notifyDepartmentHeadsByName(tx, 'IT', {
          eventType: 'purchase_request_ready_for_it_head',
          requestId: id,
          title: 'Đề nghị thiết bị chờ IT duyệt',
          body: `Đề nghị ${request.requestCode} có hạng mục điện tử cần duyệt.`,
        });
      } else {
        await this.notifyRequesterApproved(tx, request);
      }
    });

    return this.findOne(id, actor);
  }

  async decideIt(
    id: string,
    dto: PurchaseRequestDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestApproveIt,
    );
    this.authorization.assertDepartment(actor, 'IT');
    await this.db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const request = await this.requireRequest(tx, id, ['pending_it_head']);
      const revision = await this.requireCurrentRevision(tx, request);
      const items = await this.loadRevisionItems(tx, revision.id);
      if (!items.some((item) => item.managementOwnerSnapshot === 'it')) {
        throw new ConflictException('Đề nghị không có hạng mục do IT quản lý.');
      }
      if (!dto.approved) {
        await this.returnForRevision(tx, request, actor, dto.reason!);
        return;
      }

      await this.setStatus(tx, id, 'approved', actor.id);
      await this.audit.logPurchase(tx, {
        requestId: id,
        revision: request.currentRevision,
        actionType: 'purchase.request.approve_it',
        actor,
        result: 'approved',
        previousStatus: request.status,
        newStatus: 'approved',
        entityType: 'request',
        entityId: id,
      });
      await this.notifyRequesterApproved(tx, request);
    });

    return this.findOne(id, actor);
  }

  async findMine(actor: AuthenticatedEmployee) {
    return this.db
      .select({
        id: schema.purchaseRequests.id,
        requestCode: schema.purchaseRequests.requestCode,
        status: schema.purchaseRequests.status,
        revision: schema.purchaseRequests.currentRevision,
        updatedAt: schema.purchaseRequests.updatedAt,
      })
      .from(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.requesterId, actor.id))
      .orderBy(desc(schema.purchaseRequests.updatedAt));
  }

  async findQueue(actor: AuthenticatedEmployee) {
    const conditions = [];
    if (actor.isDepartmentHead) {
      conditions.push(
        and(
          eq(schema.purchaseRequests.status, 'pending_department_head'),
          eq(schema.purchaseRequests.departmentId, actor.departmentId),
        ),
      );
    }
    if (actor.departmentName === 'PROCUREMENT') {
      conditions.push(
        eq(schema.purchaseRequests.status, 'pending_procurement_enrichment'),
      );
      if (actor.isDepartmentHead) {
        conditions.push(
          eq(schema.purchaseRequests.status, 'pending_procurement_head'),
        );
      }
    }
    if (actor.departmentName === 'IT' && actor.isDepartmentHead) {
      conditions.push(eq(schema.purchaseRequests.status, 'pending_it_head'));
    }
    if (conditions.length === 0) return [];

    return this.db
      .select({
        id: schema.purchaseRequests.id,
        requestCode: schema.purchaseRequests.requestCode,
        status: schema.purchaseRequests.status,
        revision: schema.purchaseRequests.currentRevision,
        requesterName: schema.employees.fullName,
        updatedAt: schema.purchaseRequests.updatedAt,
      })
      .from(schema.purchaseRequests)
      .innerJoin(
        schema.employees,
        eq(schema.purchaseRequests.requesterId, schema.employees.id),
      )
      .where(or(...conditions))
      .orderBy(asc(schema.purchaseRequests.updatedAt));
  }

  async findOne(id: string, actor: AuthenticatedEmployee) {
    await this.authorization.assertCanViewRequest(id, actor);
    return this.buildDetail(id, actor);
  }

  private async buildDetail(id: string, actor: AuthenticatedEmployee) {
    const [request] = await this.db
      .select({
        id: schema.purchaseRequests.id,
        requestCode: schema.purchaseRequests.requestCode,
        status: schema.purchaseRequests.status,
        currentRevision: schema.purchaseRequests.currentRevision,
        requesterId: schema.purchaseRequests.requesterId,
        requesterName: schema.employees.fullName,
        departmentId: schema.purchaseRequests.departmentId,
        departmentName: schema.departments.name,
        createdAt: schema.purchaseRequests.createdAt,
        updatedAt: schema.purchaseRequests.updatedAt,
      })
      .from(schema.purchaseRequests)
      .innerJoin(
        schema.employees,
        eq(schema.purchaseRequests.requesterId, schema.employees.id),
      )
      .innerJoin(
        schema.departments,
        eq(schema.purchaseRequests.departmentId, schema.departments.id),
      )
      .where(eq(schema.purchaseRequests.id, id));
    if (!request) throw new NotFoundException('Không tìm thấy đề nghị mua.');

    const [revision] = await this.db
      .select()
      .from(schema.purchaseRequestRevisions)
      .where(
        and(
          eq(schema.purchaseRequestRevisions.purchaseRequestId, id),
          eq(
            schema.purchaseRequestRevisions.revisionNumber,
            request.currentRevision,
          ),
        ),
      );
    const items = await this.db
      .select({
        id: schema.purchaseRequestItems.id,
        assetCategoryId: schema.purchaseRequestItems.assetCategoryId,
        categoryName: schema.assetCategories.name,
        itemName: schema.purchaseRequestItems.itemName,
        specifications: schema.purchaseRequestItems.specifications,
        purpose: schema.purchaseRequestItems.purpose,
        quantity: schema.purchaseRequestItems.quantity,
        managementOwner: schema.purchaseRequestItems.managementOwnerSnapshot,
        trackingMode: schema.purchaseRequestItems.trackingModeSnapshot,
        sortOrder: schema.purchaseRequestItems.sortOrder,
      })
      .from(schema.purchaseRequestItems)
      .innerJoin(
        schema.assetCategories,
        eq(
          schema.purchaseRequestItems.assetCategoryId,
          schema.assetCategories.id,
        ),
      )
      .where(eq(schema.purchaseRequestItems.requestRevisionId, revision.id))
      .orderBy(asc(schema.purchaseRequestItems.sortOrder));
    const visibleItems =
      actor.departmentName === 'IT'
        ? items.filter((item) => item.managementOwner === 'it')
        : items;
    const itemIds = visibleItems.map((item) => item.id);
    const quotes =
      itemIds.length === 0
        ? []
        : await this.db
            .select({
              id: schema.purchaseRequestQuotes.id,
              requestItemId: schema.purchaseRequestQuotes.requestItemId,
              supplierId: schema.purchaseRequestQuotes.supplierId,
              supplierName: schema.suppliers.legalName,
              attachmentId: schema.purchaseRequestQuotes.attachmentId,
              attachmentUrl: schema.attachments.url,
              unitPriceExclVat: schema.purchaseRequestQuotes.unitPriceExclVat,
              vatRate: schema.purchaseRequestQuotes.vatRate,
              isSelected: schema.purchaseRequestQuotes.isSelected,
              note: schema.purchaseRequestQuotes.note,
            })
            .from(schema.purchaseRequestQuotes)
            .innerJoin(
              schema.suppliers,
              eq(schema.purchaseRequestQuotes.supplierId, schema.suppliers.id),
            )
            .innerJoin(
              schema.attachments,
              eq(
                schema.purchaseRequestQuotes.attachmentId,
                schema.attachments.id,
              ),
            )
            .where(
              inArray(schema.purchaseRequestQuotes.requestItemId, itemIds),
            );
    const timeline = await this.audit.findTrail('purchase', id);
    const pendingAction = this.pendingAction(request.status);
    const allowedActions = this.allowedActionsForRequest(actor, request);

    return {
      id: request.id,
      status: request.status,
      revision: request.currentRevision,
      pendingAction,
      allowedActions,
      timeline,
      data: {
        ...request,
        revision: {
          id: revision.id,
          neededByDate: revision.neededByDate,
          purpose: revision.purpose,
          note: revision.note,
          submittedAt: revision.submittedAt,
          returnReason: revision.returnReason,
        },
        items: visibleItems.map((item) => ({
          ...item,
          quotes: quotes.filter((quote) => quote.requestItemId === item.id),
        })),
      },
    };
  }

  private async loadCategories(dto: SavePurchaseRequestDto) {
    const ids = [...new Set(dto.items.map((item) => item.assetCategoryId))];
    const categories = await this.db
      .select({
        id: schema.assetCategories.id,
        managementOwner: schema.assetCategories.managementOwner,
        trackingMode: schema.assetCategories.trackingMode,
      })
      .from(schema.assetCategories)
      .where(inArray(schema.assetCategories.id, ids));
    if (categories.length !== ids.length) {
      throw new BadRequestException('Có danh mục tài sản không tồn tại.');
    }
    return new Map(categories.map((category) => [category.id, category]));
  }

  private async insertItems(
    db: Database,
    revisionId: string,
    dto: SavePurchaseRequestDto,
    categories: Awaited<ReturnType<PurchaseRequestsService['loadCategories']>>,
    actorId: string,
  ) {
    await db.insert(schema.purchaseRequestItems).values(
      dto.items.map((item, index) => {
        const category = categories.get(item.assetCategoryId)!;
        return {
          requestRevisionId: revisionId,
          assetCategoryId: item.assetCategoryId,
          itemName: item.itemName,
          specifications: item.specifications,
          purpose: item.purpose,
          quantity: item.quantity,
          unit: 'đơn vị',
          managementOwnerSnapshot: category.managementOwner,
          trackingModeSnapshot: category.trackingMode,
          sortOrder: index + 1,
          createdBy: actorId,
          updatedBy: actorId,
        };
      }),
    );
  }

  private async requireRequest(
    db: Database,
    id: string,
    statuses?: PurchaseRequestStatus[],
  ) {
    const [request] = await db
      .select()
      .from(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.id, id));
    if (!request) throw new NotFoundException('Không tìm thấy đề nghị mua.');
    if (statuses && !statuses.includes(request.status)) {
      throw new ConflictException(
        `Không thể thực hiện hành động khi đề nghị ở trạng thái ${request.status}.`,
      );
    }
    return request;
  }

  private async requireCurrentRevision(
    db: Database,
    request: typeof schema.purchaseRequests.$inferSelect,
  ) {
    const [revision] = await db
      .select()
      .from(schema.purchaseRequestRevisions)
      .where(
        and(
          eq(schema.purchaseRequestRevisions.purchaseRequestId, request.id),
          eq(
            schema.purchaseRequestRevisions.revisionNumber,
            request.currentRevision,
          ),
        ),
      );
    if (!revision)
      throw new ConflictException('Revision hiện tại không tồn tại.');
    return revision;
  }

  private loadRevisionItems(db: Database, revisionId: string) {
    return db
      .select()
      .from(schema.purchaseRequestItems)
      .where(eq(schema.purchaseRequestItems.requestRevisionId, revisionId))
      .orderBy(asc(schema.purchaseRequestItems.sortOrder));
  }

  private async requireCommercialData(
    db: Database,
    request: typeof schema.purchaseRequests.$inferSelect,
  ) {
    const revision = await this.requireCurrentRevision(db, request);
    const items = await this.loadRevisionItems(db, revision.id);
    const quotes = await db
      .select({
        requestItemId: schema.purchaseRequestQuotes.requestItemId,
        isSelected: schema.purchaseRequestQuotes.isSelected,
      })
      .from(schema.purchaseRequestQuotes)
      .where(
        inArray(
          schema.purchaseRequestQuotes.requestItemId,
          items.map((item) => item.id),
        ),
      );
    const incomplete = items.some((item) => {
      const itemQuotes = quotes.filter(
        (quote) => quote.requestItemId === item.id,
      );
      return (
        itemQuotes.length === 0 || !itemQuotes.some((quote) => quote.isSelected)
      );
    });
    if (incomplete) {
      throw new BadRequestException(
        'Mỗi hạng mục phải có ít nhất một báo giá và một báo giá được chọn.',
      );
    }
  }

  private async returnForRevision(
    db: Database,
    request: typeof schema.purchaseRequests.$inferSelect,
    actor: AuthenticatedEmployee,
    reason: string,
  ) {
    const revision = await this.requireCurrentRevision(db, request);
    const items = await this.loadRevisionItems(db, revision.id);
    const nextRevisionNumber = request.currentRevision + 1;
    const now = new Date();
    await db
      .update(schema.purchaseRequestRevisions)
      .set({ returnedAt: now, returnedBy: actor.id, returnReason: reason })
      .where(eq(schema.purchaseRequestRevisions.id, revision.id));
    const [nextRevision] = await db
      .insert(schema.purchaseRequestRevisions)
      .values({
        purchaseRequestId: request.id,
        revisionNumber: nextRevisionNumber,
        neededByDate: revision.neededByDate,
        purpose: revision.purpose,
        note: revision.note,
        returnReason: reason,
        createdBy: request.requesterId,
      })
      .returning();
    await db.insert(schema.purchaseRequestItems).values(
      items.map((item) => ({
        requestRevisionId: nextRevision.id,
        assetCategoryId: item.assetCategoryId,
        itemName: item.itemName,
        specifications: item.specifications,
        purpose: item.purpose,
        quantity: item.quantity,
        unit: item.unit,
        managementOwnerSnapshot: item.managementOwnerSnapshot,
        trackingModeSnapshot: item.trackingModeSnapshot,
        sortOrder: item.sortOrder,
        createdBy: request.requesterId,
        updatedBy: request.requesterId,
      })),
    );
    await db
      .update(schema.purchaseRequests)
      .set({
        status: 'revision_required',
        currentRevision: nextRevisionNumber,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(schema.purchaseRequests.id, request.id));
    await this.audit.logPurchase(db, {
      requestId: request.id,
      revision: request.currentRevision,
      actionType: 'purchase.request.reject',
      actor,
      result: 'rejected',
      previousStatus: request.status,
      newStatus: 'revision_required',
      reason,
      entityType: 'request',
      entityId: request.id,
      metadata: { nextRevision: nextRevisionNumber },
    });
    await this.notifications.create(db, {
      recipientId: request.requesterId,
      eventType: 'purchase_request_returned_for_revision',
      entityType: 'request',
      entityId: request.id,
      title: 'Đề nghị mua cần điều chỉnh',
      body: `${request.requestCode} đã được trả về: ${reason}`,
      metadata: { revision: nextRevisionNumber },
    });
  }

  private setStatus(
    db: Database,
    id: string,
    status: PurchaseRequestStatus,
    actorId: string,
  ) {
    return db
      .update(schema.purchaseRequests)
      .set({ status, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(schema.purchaseRequests.id, id));
  }

  private async notifyDepartmentHeads(
    db: Database,
    departmentId: string,
    entry: {
      eventType: 'purchase_request_submitted';
      requestId: string;
      title: string;
      body: string;
    },
  ) {
    const recipients = await db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .where(
        and(
          eq(schema.employees.departmentId, departmentId),
          eq(schema.employees.isDepartmentHead, true),
          eq(schema.employees.isActive, true),
        ),
      );
    await this.notifications.createMany(
      db,
      recipients.map((recipient) => ({
        recipientId: recipient.id,
        eventType: entry.eventType,
        entityType: 'request' as const,
        entityId: entry.requestId,
        title: entry.title,
        body: entry.body,
      })),
    );
  }

  private async notifyDepartment(
    db: Database,
    departmentName: string,
    entry: {
      eventType: 'purchase_request_ready_for_procurement';
      requestId: string;
      title: string;
      body: string;
    },
  ) {
    const recipients = await this.departmentRecipients(
      db,
      departmentName,
      false,
    );
    await this.notifications.createMany(
      db,
      recipients.map((recipient) => ({
        recipientId: recipient.id,
        eventType: entry.eventType,
        entityType: 'request' as const,
        entityId: entry.requestId,
        title: entry.title,
        body: entry.body,
      })),
    );
  }

  private async notifyDepartmentHeadsByName(
    db: Database,
    departmentName: string,
    entry: {
      eventType:
        | 'purchase_request_ready_for_procurement_head'
        | 'purchase_request_ready_for_it_head';
      requestId: string;
      title: string;
      body: string;
    },
  ) {
    const recipients = await this.departmentRecipients(
      db,
      departmentName,
      true,
    );
    await this.notifications.createMany(
      db,
      recipients.map((recipient) => ({
        recipientId: recipient.id,
        eventType: entry.eventType,
        entityType: 'request' as const,
        entityId: entry.requestId,
        title: entry.title,
        body: entry.body,
      })),
    );
  }

  private departmentRecipients(
    db: Database,
    departmentName: string,
    headsOnly: boolean,
  ) {
    return db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .innerJoin(
        schema.departments,
        eq(schema.employees.departmentId, schema.departments.id),
      )
      .where(
        and(
          eq(schema.departments.name, departmentName),
          eq(schema.employees.isActive, true),
          ...(headsOnly ? [eq(schema.employees.isDepartmentHead, true)] : []),
        ),
      );
  }

  private notifyRequesterApproved(
    db: Database,
    request: typeof schema.purchaseRequests.$inferSelect,
  ) {
    return this.notifications.create(db, {
      recipientId: request.requesterId,
      eventType: 'purchase_request_approved',
      entityType: 'request',
      entityId: request.id,
      title: 'Đề nghị mua đã được duyệt',
      body: `${request.requestCode} đã hoàn tất phê duyệt.`,
      metadata: { revision: request.currentRevision },
    });
  }

  private pendingAction(status: PurchaseRequestStatus): WorkflowAction | null {
    const actions: Partial<Record<PurchaseRequestStatus, WorkflowAction>> = {
      draft: WORKFLOW_ACTIONS.purchaseRequestSubmit,
      revision_required: WORKFLOW_ACTIONS.purchaseRequestSubmit,
      pending_department_head:
        WORKFLOW_ACTIONS.purchaseRequestApproveDepartment,
      pending_procurement_enrichment:
        WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
      pending_procurement_head:
        WORKFLOW_ACTIONS.purchaseRequestApproveProcurement,
      pending_it_head: WORKFLOW_ACTIONS.purchaseRequestApproveIt,
    };
    return actions[status] ?? null;
  }

  private allowedActionsForRequest(
    actor: AuthenticatedEmployee,
    request: {
      requesterId: string;
      departmentId: string;
      status: PurchaseRequestStatus;
    },
  ) {
    const configured = getAllowedWorkflowActions(
      actor.roleName,
      actor.isDepartmentHead,
      actor.departmentName,
    );
    const candidates: WorkflowAction[] = [];

    // Đề nghị đã duyệt hoặc đang đặt dở cho phép nhân viên Thu mua mở form đơn mua;
    if (['approved', 'ordering'].includes(request.status)) {
      candidates.push(WORKFLOW_ACTIONS.purchaseOrderCreate);
    }
    if (
      request.requesterId === actor.id &&
      ['draft', 'revision_required'].includes(request.status)
    ) {
      candidates.push(
        WORKFLOW_ACTIONS.purchaseRequestUpdate,
        WORKFLOW_ACTIONS.purchaseRequestSubmit,
      );
    }
    const pending = this.pendingAction(request.status);
    if (pending) candidates.push(pending);
    return [...new Set(candidates)].filter((action) =>
      configured.includes(action),
    );
  }

  private createRequestCode() {
    const year = new Date().getUTCFullYear();
    return `PR-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}
