import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import type { AuthenticatedEmployee } from './workflow-auth.types.js';
import {
  getAllowedWorkflowActions,
  type WorkflowAction,
} from './workflow-actions.config.js';

export type PurchaseManagementOwner = 'it' | 'procurement';

type PurchaseRequestScope = {
  requesterId: string;
  departmentId: string;
};

@Injectable()
/** Kiểm tra quyền và phạm vi dữ liệu tại service, độc lập với route guard. */
export class PurchaseAuthorizationService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  assertAction(actor: AuthenticatedEmployee, action: WorkflowAction): void {
    const actions = getAllowedWorkflowActions(
      actor.roleName,
      actor.isDepartmentHead,
      actor.departmentName,
    );

    if (!actions.includes(action)) {
      throw new ForbiddenException(`Not allowed to perform ${action}.`);
    }
  }

  assertOwnRequest(
    actor: AuthenticatedEmployee,
    request: PurchaseRequestScope,
  ): void {
    if (request.requesterId !== actor.id) {
      throw new ForbiddenException('Purchase request belongs to another user.');
    }
  }

  assertDepartmentRequest(
    actor: AuthenticatedEmployee,
    request: PurchaseRequestScope,
  ): void {
    if (
      !actor.isDepartmentHead ||
      request.departmentId !== actor.departmentId
    ) {
      throw new ForbiddenException(
        'Purchase request is outside the department scope.',
      );
    }
  }

  assertDepartment(actor: AuthenticatedEmployee, departmentName: string): void {
    if (actor.departmentName !== departmentName) {
      throw new ForbiddenException(
        `Action requires membership in ${departmentName}.`,
      );
    }
  }

  assertManagementOwner(
    actor: AuthenticatedEmployee,
    owner: PurchaseManagementOwner,
  ): void {
    this.assertDepartment(actor, owner.toUpperCase());
  }

  assertRecipient(actor: AuthenticatedEmployee, recipientId: string): void {
    if (actor.id !== recipientId) {
      throw new ForbiddenException('Allocation belongs to another recipient.');
    }
  }

  async assertCanViewRequest(
    requestId: string,
    actor: AuthenticatedEmployee,
  ): Promise<void> {
    const [request] = await this.db
      .select({
        requesterId: schema.purchaseRequests.requesterId,
        departmentId: schema.purchaseRequests.departmentId,
        status: schema.purchaseRequests.status,
        currentRevision: schema.purchaseRequests.currentRevision,
      })
      .from(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.id, requestId));

    if (!request) throw new NotFoundException('Purchase request not found.');

    if (
      request.requesterId === actor.id ||
      (actor.isDepartmentHead && request.departmentId === actor.departmentId)
    ) {
      return;
    }

    if (
      actor.departmentName === 'PROCUREMENT' &&
      !['draft', 'pending_department_head'].includes(request.status)
    ) {
      return;
    }

    if (
      actor.departmentName === 'IT' &&
      [
        'pending_it_head',
        'revision_required',
        'approved',
        'ordering',
        'fully_ordered',
      ].includes(request.status)
    ) {
      const [itItem] = await this.db
        .select({ id: schema.purchaseRequestItems.id })
        .from(schema.purchaseRequestItems)
        .innerJoin(
          schema.purchaseRequestRevisions,
          eq(
            schema.purchaseRequestItems.requestRevisionId,
            schema.purchaseRequestRevisions.id,
          ),
        )
        .where(
          and(
            eq(schema.purchaseRequestRevisions.purchaseRequestId, requestId),
            eq(
              schema.purchaseRequestRevisions.revisionNumber,
              request.currentRevision,
            ),
            eq(schema.purchaseRequestItems.managementOwnerSnapshot, 'it'),
          ),
        )
        .limit(1);

      if (itItem) return;
    }

    throw new ForbiddenException('Purchase request is outside your scope.');
  }
}
