import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

export type RequestType = 'purchase' | 'transfer' | 'repair' | 'recall';
type ApprovalResult = 'approved' | 'rejected' | 'pending';

/** Dữ liệu chuẩn hóa cho một hành động phát sinh trong bất kỳ workflow nào. */
export interface AuditEntry {
  requestType: RequestType;
  requestId: string;
  actionType: string;
  approvedBy: string;
  approverRole: string;
  status: ApprovalResult;
  notes?: string;
  metadata?: Record<string, unknown>;
  workflowRevision?: number;
  actorDepartmentId?: string;
  actorIsDepartmentHead?: boolean;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
}

export interface PurchaseAuditEntry {
  requestId: string;
  revision: number;
  actionType: string;
  actor: AuthenticatedEmployee;
  result: ApprovalResult;
  previousStatus: string;
  newStatus: string;
  reason?: string;
  entityType: 'request' | 'order' | 'receipt' | 'asset' | 'allocation';
  entityId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class RequestAuditService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /** Checks request participation before exposing a repair or transfer timeline. */
  async assertCanViewWorkflowTrail(
    requestType: 'repair' | 'transfer',
    requestId: string,
    actor: AuthenticatedEmployee,
  ) {
    let participants: Array<string | null>;
    let departments: Array<string | null>;

    if (requestType === 'repair') {
      const [request] = await this.db
        .select()
        .from(schema.repairRequests)
        .where(eq(schema.repairRequests.id, requestId));

      if (!request)
        throw new NotFoundException('Không tìm thấy phiếu sửa chữa.');

      participants = [
        request.reporterId,
        request.assignedTo,
        request.assessedBy,
        request.departmentHeadDecidedBy,
        request.itHeadDecidedBy,
        request.itHandoverDecidedBy,
        request.approvedBy,
        request.confirmedBy,
      ];
      departments = [request.departmentId];
    } else {
      const [request] = await this.db
        .select()
        .from(schema.transferRequests)
        .where(eq(schema.transferRequests.id, requestId));

      if (!request)
        throw new NotFoundException('Không tìm thấy phiếu điều chuyển.');

      participants = [
        request.initiatedBy,
        request.toUserId,
        request.senderConfirmedBy,
        request.receiverConfirmedBy,
        request.deptHeadApprovedBy,
        request.assetTeamVerifiedBy,
      ];
      departments = [request.fromDepartmentId, request.toDepartmentId];
    }

    if (
      actor.departmentName === 'IT' ||
      participants.includes(actor.id) ||
      (actor.isDepartmentHead && departments.includes(actor.departmentId))
    )
      return;

    throw new ForbiddenException(
      'Bạn không được xem lịch sử xử lý của phiếu này.',
    );
  }

  async log(
    db: NodePgDatabase<typeof schema>,
    entry: AuditEntry,
  ): Promise<void> {
    await db.insert(schema.requestApprovals).values({
      ...entry,
      metadata: entry.metadata ?? null,
    });
  }

  async logPurchase(
    db: NodePgDatabase<typeof schema>,
    entry: PurchaseAuditEntry,
  ): Promise<void> {
    await this.log(db, {
      requestType: 'purchase',
      requestId: entry.requestId,
      workflowRevision: entry.revision,
      actionType: entry.actionType,
      approvedBy: entry.actor.id,
      approverRole: entry.actor.roleName,
      actorDepartmentId: entry.actor.departmentId,
      actorIsDepartmentHead: entry.actor.isDepartmentHead,
      status: entry.result,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      reason: entry.reason,
      notes: entry.reason,
      metadata: {
        ...entry.metadata,
        entityType: entry.entityType,
        entityId: entry.entityId,
        revision: entry.revision,
      },
    });
  }

  /** Trả nhật ký theo thứ tự thời gian để giao diện có thể dựng timeline xử lý. */
  findTrail(requestType: RequestType, requestId: string) {
    return this.db
      .select()
      .from(schema.requestApprovals)
      .where(
        and(
          eq(schema.requestApprovals.requestType, requestType),
          eq(schema.requestApprovals.requestId, requestId),
        ),
      )
      .orderBy(asc(schema.requestApprovals.createdAt));
  }
}
