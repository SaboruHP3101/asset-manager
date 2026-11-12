import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import {
  CreatePurchaseQuoteDto,
  PurchaseRequestDecisionDto,
  SavePurchaseRequestDto,
} from './dto/purchase-request.dto.js';

import {
  create,
  deleteDraft,
  returnForRevision,
  update,
} from './purchase-request-drafts.js';
import {
  notifyDepartment,
  notifyDepartmentHeads,
  notifyDepartmentHeadsByName,
  notifyRequesterApproved,
} from './purchase-request-notifications.js';
import {
  buildDetail,
  findMine,
  findQueue,
  loadRevisionItems,
  requireCurrentRevision,
  requireRequest,
  setStatus,
} from './purchase-request-queries.js';
import { addQuote, requireCommercialData } from './purchase-request-quotes.js';

type Database = NodePgDatabase<typeof schema>;
@Injectable()
export class PurchaseRequestsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly authorization: PurchaseAuthorizationService,
    private readonly audit: RequestAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: SavePurchaseRequestDto, actor: AuthenticatedEmployee) {
    const id = await create(
      this.db,
      this.authorization,
      this.audit,
      dto,
      actor,
    );

    return this.findOne(id, actor);
  }

  async update(
    id: string,
    dto: SavePurchaseRequestDto,
    actor: AuthenticatedEmployee,
  ) {
    await update(this.db, this.authorization, this.audit, id, dto, actor);

    return this.findOne(id, actor);
  }

  deleteDraft(id: string, actor: AuthenticatedEmployee) {
    return deleteDraft(this.db, this.authorization, id, actor);
  }

  async addQuote(
    id: string,
    dto: CreatePurchaseQuoteDto,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedEmployee,
  ) {
    await addQuote(
      this.db,
      this.authorization,
      this.audit,
      id,
      dto,
      file,
      actor,
    );

    return this.findOne(id, actor);
  }

  findMine(actor: AuthenticatedEmployee) {
    return findMine(this.db, actor);
  }

  findQueue(actor: AuthenticatedEmployee) {
    return findQueue(this.db, actor);
  }

  async submit(id: string, actor: AuthenticatedEmployee) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestSubmit,
    );
    await this.db.transaction(async (tx) => {
      const request = await requireRequest(tx, id, [
        'draft',
        'revision_required',
      ]);

      this.authorization.assertOwnRequest(actor, request);
      const revision = await requireCurrentRevision(tx, request);
      const items = await loadRevisionItems(tx, revision.id);

      if (items.length === 0) {
        throw new BadRequestException('Đề nghị phải có ít nhất một hạng mục.');
      }

      const now = new Date();

      await tx
        .update(schema.purchaseRequestRevisions)
        .set({ submittedAt: now, submittedBy: actor.id })
        .where(eq(schema.purchaseRequestRevisions.id, revision.id));
      await setStatus(tx, id, 'pending_department_head', actor.id);
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
      await notifyDepartmentHeads(
        this.notifications,
        tx,
        request.departmentId,
        {
          eventType: 'purchase_request_submitted',
          requestId: id,
          title: 'Đề nghị mua đang chờ duyệt',
          body: `Đề nghị ${request.requestCode} đang chờ Trưởng phòng xử lý.`,
        },
      );
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
    await this.db.transaction(async (tx) => {
      const request = await requireRequest(tx, id, ['pending_department_head']);

      this.authorization.assertDepartmentRequest(actor, request);

      if (!dto.approved) {
        await returnForRevision(
          this.audit,
          this.notifications,
          tx,
          request,
          actor,
          dto.reason!,
        );

        return;
      }

      await setStatus(tx, id, 'pending_procurement_enrichment', actor.id);
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
      await notifyDepartment(this.notifications, tx, 'PROCUREMENT', {
        eventType: 'purchase_request_ready_for_procurement',
        requestId: id,
        title: 'Đề nghị mua cần bổ sung báo giá',
        body: `Đề nghị ${request.requestCode} đã qua duyệt cấp phòng.`,
      });
    });

    return this.findOne(id, actor);
  }

  async submitProcurement(id: string, actor: AuthenticatedEmployee) {
    this.authorization.assertAction(
      actor,
      WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
    );
    this.authorization.assertDepartment(actor, 'PROCUREMENT');
    await this.db.transaction(async (tx) => {
      const request = await requireRequest(tx, id, [
        'pending_procurement_enrichment',
      ]);

      await requireCommercialData(tx, request);
      await setStatus(tx, id, 'pending_procurement_head', actor.id);
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
      await notifyDepartmentHeadsByName(this.notifications, tx, 'PROCUREMENT', {
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
    await this.db.transaction(async (tx) => {
      const request = await requireRequest(tx, id, [
        'pending_procurement_head',
      ]);

      const { items } = await requireCommercialData(tx, request);

      if (!dto.approved) {
        await returnForRevision(
          this.audit,
          this.notifications,
          tx,
          request,
          actor,
          dto.reason!,
        );

        return;
      }

      const hasItItems = items.some(
        (item) => item.managementOwnerSnapshot === 'it',
      );
      const nextStatus = hasItItems ? 'pending_it_head' : 'approved';

      await setStatus(tx, id, nextStatus, actor.id);
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
        await notifyDepartmentHeadsByName(this.notifications, tx, 'IT', {
          eventType: 'purchase_request_ready_for_it_head',
          requestId: id,
          title: 'Đề nghị thiết bị chờ IT duyệt',
          body: `Đề nghị ${request.requestCode} có hạng mục điện tử cần duyệt.`,
        });
      } else {
        await notifyRequesterApproved(this.notifications, tx, request);
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
    await this.db.transaction(async (tx) => {
      const request = await requireRequest(tx, id, ['pending_it_head']);
      const revision = await requireCurrentRevision(tx, request);
      const items = await loadRevisionItems(tx, revision.id);

      if (!items.some((item) => item.managementOwnerSnapshot === 'it')) {
        throw new ConflictException('Đề nghị không có hạng mục do IT quản lý.');
      }

      if (!dto.approved) {
        await returnForRevision(
          this.audit,
          this.notifications,
          tx,
          request,
          actor,
          dto.reason!,
        );

        return;
      }

      await setStatus(tx, id, 'approved', actor.id);
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
      await notifyRequesterApproved(this.notifications, tx, request);
    });

    return this.findOne(id, actor);
  }

  async findOne(id: string, actor: AuthenticatedEmployee) {
    await this.authorization.assertCanViewRequest(id, actor);

    return buildDetail(this.db, this.audit, id, actor);
  }
}
