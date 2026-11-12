import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { addMonths, monthOf } from './depreciation-calculation.js';
import type { DepreciationProfileDto } from './dto/depreciation-workflow.dto.js';

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function assertAction(
  actor: AuthenticatedEmployee,
  action: WorkflowAction,
) {
  if (
    !getAllowedWorkflowActions(
      actor.roleName,
      actor.isDepartmentHead,
      actor.departmentName,
    ).includes(action)
  ) {
    throw new ForbiddenException(
      'Bạn không có quyền thực hiện thao tác khấu hao này.',
    );
  }
}

// Serialize configuration, preparation, and recording with one transaction lock.
export async function lock(tx: Transaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(16741020)`);
}

export async function getSettings(db: Database, actor: AuthenticatedEmployee) {
  assertAction(actor, WORKFLOW_ACTIONS.depreciationView);
  const [settings] = await db.select().from(schema.depreciationSettings);

  return settings ?? null;
}

export async function listAssets(db: Database, actor: AuthenticatedEmployee) {
  assertAction(actor, WORKFLOW_ACTIONS.depreciationView);

  return db
    .select({
      id: schema.assets.id,
      assetCode: schema.assets.assetCode,
      name: schema.assets.name,
      initialValue: schema.assets.initialValue,
      inServiceDate: schema.assets.inServiceDate,
      profile: schema.assetDepreciationProfiles,
    })
    .from(schema.assets)
    .leftJoin(
      schema.assetDepreciationProfiles,
      eq(schema.assets.id, schema.assetDepreciationProfiles.assetId),
    )
    .orderBy(asc(schema.assets.assetCode));
}

export async function configureAsset(
  db: Database,
  assetId: string,
  dto: DepreciationProfileDto,
  actor: AuthenticatedEmployee,
) {
  assertAction(actor, WORKFLOW_ACTIONS.depreciationPrepare);

  return db.transaction(async (tx) => {
    await lock(tx);
    const [settings] = await tx.select().from(schema.depreciationSettings);
    const [asset] = await tx
      .select({ id: schema.assets.id })
      .from(schema.assets)
      .where(eq(schema.assets.id, assetId));

    if (!settings)
      throw new BadRequestException(
        'Chọn tháng bắt đầu quản lý khấu hao trước.',
      );

    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');

    if (
      dto.firstMonth < settings.firstMonth ||
      dto.firstMonth < monthOf(dto.startDate)
    ) {
      throw new BadRequestException(
        'Tháng bắt đầu phải từ tháng quản lý và tháng bắt đầu khấu hao trở đi.',
      );
    }

    if (dto.remainingMonths > dto.termMonths) {
      throw new BadRequestException(
        'Thời gian còn lại không được vượt tổng thời hạn khấu hao.',
      );
    }

    if (BigInt(dto.openingValue) > BigInt(dto.originalCost)) {
      throw new BadRequestException('Số dư đầu kỳ không được vượt nguyên giá.');
    }

    if (dto.stopDate && dto.stopDate < dto.startDate) {
      throw new BadRequestException(
        'Ngày dừng không được trước ngày bắt đầu khấu hao.',
      );
    }

    const [pending] = await tx
      .select({ id: schema.depreciationPeriods.id })
      .from(schema.depreciationPeriods)
      .where(eq(schema.depreciationPeriods.status, 'pending_approval'))
      .limit(1);

    if (pending)
      throw new ConflictException(
        'Cần duyệt hoặc trả lại kỳ chờ duyệt trước khi sửa cấu hình.',
      );

    const [existing] = await tx
      .select()
      .from(schema.assetDepreciationProfiles)
      .where(eq(schema.assetDepreciationProfiles.assetId, assetId));

    const [latest] = await tx
      .select()
      .from(schema.depreciationPeriods)
      .where(eq(schema.depreciationPeriods.status, 'recorded'))
      .orderBy(desc(schema.depreciationPeriods.month))
      .limit(1);

    const [posted] = await tx
      .select({ id: schema.assetDepreciations.id })
      .from(schema.assetDepreciations)
      .where(
        and(
          eq(schema.assetDepreciations.assetId, assetId),
          sql`${schema.assetDepreciations.periodId} is not null`,
        ),
      )
      .limit(1);

    const values = { ...dto, stopDate: dto.stopDate ?? null };

    if (posted && existing) {
      const changed = (
        [
          'originalCost',
          'openingValue',
          'firstMonth',
          'startDate',
          'termMonths',
          'remainingMonths',
        ] as const
      ).some((field) => existing[field] !== dto[field]);

      if (changed)
        throw new ConflictException(
          'Tài sản đã ghi nhận khấu hao; chỉ có thể cập nhật ngày dừng trong tương lai.',
        );
    } else if (latest && dto.firstMonth <= latest.month) {
      throw new ConflictException(
        'Tháng bắt đầu của tài sản phải sau kỳ đã ghi nhận gần nhất.',
      );
    }

    const stopChanged = values.stopDate !== (existing?.stopDate ?? null);

    if (
      latest &&
      stopChanged &&
      ((existing?.stopDate && existing.stopDate < addMonths(latest.month, 1)) ||
        (values.stopDate && values.stopDate < addMonths(latest.month, 1)))
    ) {
      throw new ConflictException(
        'Ngày dừng phải sau kỳ đã ghi nhận gần nhất.',
      );
    }

    const [profile] = await tx
      .insert(schema.assetDepreciationProfiles)
      .values({ assetId, ...values, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: schema.assetDepreciationProfiles.assetId,
        set: { ...values, updatedAt: new Date(), updatedBy: actor.id },
      })
      .returning();

    return profile;
  });
}
