import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { isDeepStrictEqual } from 'node:util';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import {
  addMonths,
  calculateDepreciation,
  lastDueMonth,
} from './depreciation-calculation.js';
import {
  assertAction,
  configureAsset,
  getSettings,
  listAssets,
  lock,
} from './depreciation-settings.js';
import type {
  DepreciationDecisionDto,
  DepreciationProfileDto,
  DepreciationSettingsDto,
} from './dto/depreciation-workflow.dto.js';

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Period = typeof schema.depreciationPeriods.$inferSelect;
@Injectable()
export class AssetDepreciationsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AssetDepreciationsService.name);
  private timer?: NodeJS.Timeout;
  private stopped = false;
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}
  getSettings(actor: AuthenticatedEmployee) {
    return getSettings(this.db, actor);
  }

  listAssets(actor: AuthenticatedEmployee) {
    return listAssets(this.db, actor);
  }

  configureAsset(
    assetId: string,
    dto: DepreciationProfileDto,
    actor: AuthenticatedEmployee,
  ) {
    return configureAsset(this.db, assetId, dto, actor);
  }
  onApplicationBootstrap() {
    this.tick();
  }

  onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  private async tick() {
    try {
      await this.ensureDuePeriods();
    } catch (error) {
      this.logger.error(
        'Không thể chuẩn bị kỳ khấu hao; hệ thống sẽ thử lại sau một phút.',
        error,
      );
    } finally {
      if (!this.stopped)
        this.timer = setTimeout(() => this.tick(), 60_000).unref();
    }
  }

  async initialize(dto: DepreciationSettingsDto, actor: AuthenticatedEmployee) {
    assertAction(actor, WORKFLOW_ACTIONS.depreciationPrepare);

    await this.db.transaction(async (tx) => {
      await lock(tx);

      const [existing] = await tx.select().from(schema.depreciationSettings);

      if (existing)
        throw new ConflictException(
          'Đã chọn tháng bắt đầu; không thể thay đổi sau khi khởi tạo.',
        );

      await tx
        .insert(schema.depreciationSettings)
        .values({ firstMonth: dto.firstMonth });
    });

    await this.ensureDuePeriods();

    return getSettings(this.db, actor);
  }

  async ensureDuePeriods(now = new Date()) {
    return this.db.transaction(async (tx) => {
      await lock(tx);
      const [settings] = await tx.select().from(schema.depreciationSettings);

      if (!settings) return;

      const due = lastDueMonth(now);
      const existing = await tx
        .select({ month: schema.depreciationPeriods.month })
        .from(schema.depreciationPeriods);
      const existingMonths = new Set(existing.map((period) => period.month));

      for (
        let month = settings.firstMonth;
        month <= due;
        month = addMonths(month, 1)
      ) {
        if (existingMonths.has(month)) continue;

        const [created] = await tx
          .insert(schema.depreciationPeriods)
          .values({ month })
          .onConflictDoNothing({ target: schema.depreciationPeriods.month })
          .returning();

        if (created && !(await this.hasEarlierOpenPeriod(tx, month)))
          await this.calculate(tx, created);
      }
    });
  }

  async findAll(actor: AuthenticatedEmployee) {
    assertAction(actor, WORKFLOW_ACTIONS.depreciationView);
    // Opening the list also prepares missing due periods, matching scheduler behavior.
    await this.ensureDuePeriods();
    const periods = await this.db
      .select()
      .from(schema.depreciationPeriods)
      .orderBy(desc(schema.depreciationPeriods.month));

    return periods.map(({ lines, ...period }) => ({
      ...period,
      assetCount: lines.length,
      totalDepreciation: lines
        .reduce((total, line) => total + BigInt(line.depreciationAmount), 0n)
        .toString(),
    }));
  }

  async findOne(id: string, actor: AuthenticatedEmployee) {
    assertAction(actor, WORKFLOW_ACTIONS.depreciationView);
    const [period] = await this.db
      .select()
      .from(schema.depreciationPeriods)
      .where(eq(schema.depreciationPeriods.id, id));

    if (!period) throw new NotFoundException('Không tìm thấy kỳ khấu hao.');

    const history = await this.db
      .select({
        action: schema.requestApprovals.actionType,
        actorId: schema.requestApprovals.approvedBy,
        actorName: schema.employees.fullName,
        reason: schema.requestApprovals.reason,
        createdAt: schema.requestApprovals.createdAt,
      })
      .from(schema.requestApprovals)
      .innerJoin(
        schema.employees,
        eq(schema.employees.id, schema.requestApprovals.approvedBy),
      )
      .where(
        and(
          eq(schema.requestApprovals.requestType, 'depreciation'),
          eq(schema.requestApprovals.requestId, id),
        ),
      )
      .orderBy(asc(schema.requestApprovals.createdAt));

    return { ...period, history };
  }

  async recalculate(id: string, actor: AuthenticatedEmployee) {
    assertAction(actor, WORKFLOW_ACTIONS.depreciationPrepare);
    await this.db.transaction(async (tx) => {
      await lock(tx);
      const period = await this.requirePeriod(tx, id, 'draft');

      await this.assertPreviousRecorded(tx, period.month);
      await this.calculate(tx, period);
    });

    return this.findOne(id, actor);
  }

  async submit(id: string, actor: AuthenticatedEmployee) {
    assertAction(actor, WORKFLOW_ACTIONS.depreciationPrepare);
    await this.db.transaction(async (tx) => {
      await lock(tx);
      const period = await this.requirePeriod(tx, id, 'draft');

      await this.assertPreviousRecorded(tx, period.month);
      await this.assertSnapshot(tx, period);
      await tx
        .update(schema.depreciationPeriods)
        .set({
          status: 'pending_approval',
          submittedBy: actor.id,
          returnReason: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.depreciationPeriods.id, id));
      await this.log(tx, period, actor, 'submitted', 'pending_approval');
    });

    return this.findOne(id, actor);
  }

  async decide(
    id: string,
    dto: DepreciationDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    assertAction(actor, WORKFLOW_ACTIONS.depreciationApprove);
    const reason = dto.reason?.trim();

    if (dto.decision === 'return' && !reason)
      throw new BadRequestException('Nhập lý do trả lại kỳ khấu hao.');

    await this.db.transaction(async (tx) => {
      await lock(tx);
      const period = await this.requirePeriod(tx, id, 'pending_approval');

      if (period.submittedBy === actor.id)
        throw new ForbiddenException(
          'Người gửi không được tự duyệt kỳ khấu hao.',
        );

      if (dto.decision === 'return') {
        await tx
          .update(schema.depreciationPeriods)
          .set({
            status: 'draft',
            returnReason: reason,
            updatedAt: new Date(),
          })
          .where(eq(schema.depreciationPeriods.id, id));
        await this.log(tx, period, actor, 'returned', 'draft', reason);

        return;
      }

      await this.assertPreviousRecorded(tx, period.month);
      await this.assertSnapshot(tx, period);

      for (const line of period.lines) {
        await tx
          .select({ id: schema.assets.id })
          .from(schema.assets)
          .where(eq(schema.assets.id, line.assetId))
          .for('update');
        await tx.insert(schema.assetDepreciations).values({
          ...line,
          periodId: id,
          depreciationMethod: 'straight_line',
          createdBy: actor.id,
          updatedBy: actor.id,
        });
        await tx
          .update(schema.assets)
          .set({
            currentValue: line.remainingValue,
            updatedAt: new Date(),
            updatedBy: actor.id,
          })
          .where(eq(schema.assets.id, line.assetId));
      }

      await tx
        .update(schema.depreciationPeriods)
        .set({ status: 'recorded', updatedAt: new Date() })
        .where(eq(schema.depreciationPeriods.id, id));
      await this.log(tx, period, actor, 'approved', 'recorded');
    });

    return this.findOne(id, actor);
  }

  private async requirePeriod(
    tx: Transaction,
    id: string,
    status: Period['status'],
  ) {
    const [period] = await tx
      .select()
      .from(schema.depreciationPeriods)
      .where(eq(schema.depreciationPeriods.id, id));

    if (!period) throw new NotFoundException('Không tìm thấy kỳ khấu hao.');

    if (period.status !== status)
      throw new ConflictException(
        'Kỳ khấu hao đã chuyển trạng thái; tải lại để tiếp tục.',
      );

    return period;
  }

  private async hasEarlierOpenPeriod(tx: Transaction, month: string) {
    const [earlier] = await tx
      .select({ id: schema.depreciationPeriods.id })
      .from(schema.depreciationPeriods)
      .where(
        and(
          lt(schema.depreciationPeriods.month, month),
          sql`${schema.depreciationPeriods.status} <> 'recorded'`,
        ),
      )
      .limit(1);

    return !!earlier;
  }

  private async assertPreviousRecorded(tx: Transaction, month: string) {
    if (await this.hasEarlierOpenPeriod(tx, month))
      throw new ConflictException(
        'Ghi nhận kỳ trước trước khi tính hoặc gửi duyệt kỳ này.',
      );
  }

  private async buildLines(
    tx: Transaction,
    month: string,
  ): Promise<schema.DepreciationLine[]> {
    const profiles = await tx
      .select({
        profile: schema.assetDepreciationProfiles,
        assetCode: schema.assets.assetCode,
        name: schema.assets.name,
      })
      .from(schema.assetDepreciationProfiles)
      .innerJoin(
        schema.assets,
        eq(schema.assets.id, schema.assetDepreciationProfiles.assetId),
      )
      .orderBy(asc(schema.assets.id));

    const history = await tx
      .select({
        assetId: schema.assetDepreciations.assetId,
        remainingValue: schema.assetDepreciations.remainingValue,
      })
      .from(schema.assetDepreciations)
      .innerJoin(
        schema.depreciationPeriods,
        eq(schema.depreciationPeriods.id, schema.assetDepreciations.periodId),
      )
      .where(
        and(
          lt(schema.depreciationPeriods.month, month),
          eq(schema.depreciationPeriods.status, 'recorded'),
        ),
      )
      .orderBy(desc(schema.depreciationPeriods.month));

    const balances = new Map<string, string>();

    for (const record of history) {
      if (!balances.has(record.assetId))
        balances.set(record.assetId, record.remainingValue);
    }

    return profiles.flatMap(({ profile, assetCode, name }) => {
      const calculation = calculateDepreciation(
        profile,
        month,
        balances.get(profile.assetId) ?? profile.openingValue,
      );

      return calculation
        ? [
            {
              assetId: profile.assetId,
              assetCode,
              name,
              originalCost: profile.originalCost,
              termMonths: profile.termMonths,
              ...calculation,
            },
          ]
        : [];
    });
  }

  private async calculate(tx: Transaction, period: Period) {
    const lines = await this.buildLines(tx, period.month);

    await tx
      .update(schema.depreciationPeriods)
      .set({ lines, calculatedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.depreciationPeriods.id, period.id));
  }

  private async assertSnapshot(tx: Transaction, period: Period) {
    if (
      !period.calculatedAt ||
      !isDeepStrictEqual(period.lines, await this.buildLines(tx, period.month))
    ) {
      throw new ConflictException(
        'Dữ liệu khấu hao đã thay đổi hoặc chưa tính; trả về nháp và tính lại trước khi gửi duyệt.',
      );
    }
  }

  private async log(
    tx: Transaction,
    period: Period,
    actor: AuthenticatedEmployee,
    action: string,
    status: Period['status'],
    reason?: string,
  ) {
    await tx.insert(schema.requestApprovals).values({
      requestType: 'depreciation',
      requestId: period.id,
      actionType: `depreciation.${action}`,
      approvedBy: actor.id,
      approverRole: actor.roleName,
      actorDepartmentId: actor.departmentId,
      actorIsDepartmentHead: actor.isDepartmentHead,
      previousStatus: period.status,
      newStatus: status,
      status:
        action === 'approved'
          ? 'approved'
          : action === 'returned'
            ? 'rejected'
            : 'pending',
      reason,
    });
  }
}
