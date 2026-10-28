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
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../auth/workflow-actions.config.js';
import * as schema from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import {
  addMonths,
  calculateDepreciation,
  lastDueMonth,
  monthOf,
} from './depreciation-calculation.js';
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

  /**
   * Gọi khi ứng dụng khởi động và tự động chuẩn bị kỳ
   */
  onApplicationBootstrap() {
    this.tick();
  }

  /**
   * Huỷ hẹn giờ, nếu tick() đang chạy thì vẫn sẽ hoàn tất nhưng không hẹn cho các đợt sau
   */
  onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  private async tick() {
    try {
      await this.ensureDuePeriods();
    } catch (error) {
      // Ghi lỗi vào log nếu có
      this.logger.error(
        'Không thể chuẩn bị kỳ khấu hao; hệ thống sẽ thử lại sau một phút.',
        error,
      );
    } finally {
      // Hẹn chạy lại sau 60 giây khi ensureDuePeriods xử lý xong
      if (!this.stopped)
        this.timer = setTimeout(() => this.tick(), 60_000).unref();
    }
  }

  /**
   * Hàm kiểm tra xem actor có quyền thực hiện action không
   */
  private assertAction(actor: AuthenticatedEmployee, action: WorkflowAction) {
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

  /**
   * Advisory lock của PostgreSQL để xử lý khi trùng lặp xảy ra. Ví dụ
   * 1. Request A lấy lock.
   * 2. Request B dùng cùng khóa (16741020) nên phải chờ.
   * 3. A duyệt xong và commit vào database.
   * 4. B tiếp tục, đọc thấy kỳ đã record vào database, nên bị chặn (trong hàm initialize phía dưới)
   * 16741020 là mã khóa dùng chung cho khấu hao
   */
  private async lock(tx: Transaction) {
    await tx.execute(sql`select pg_advisory_xact_lock(16741020)`);
  }

  /**
   * Lấy cấu hình khấu hao
   */
  async getSettings(actor: AuthenticatedEmployee) {
    this.assertAction(actor, WORKFLOW_ACTIONS.depreciationView);
    const [settings] = await this.db.select().from(schema.depreciationSettings);

    return settings ?? null;
  }

  /**
   * Chọn tháng bắt đầu sử lý
   */
  async initialize(dto: DepreciationSettingsDto, actor: AuthenticatedEmployee) {
    this.assertAction(actor, WORKFLOW_ACTIONS.depreciationPrepare);

    // Bắt đầu giao dịch (transaction)
    await this.db.transaction(async (tx) => {
      await this.lock(tx);

      // Lấy cấu hình
      const [existing] = await tx.select().from(schema.depreciationSettings);

      // Kiểm tra có cấu hình chưa, nếu chưa thì thêm (hàm insert bên dưới)
      if (existing)
        throw new ConflictException(
          'Đã chọn tháng bắt đầu; không thể thay đổi sau khi khởi tạo.',
        );

      await tx
        .insert(schema.depreciationSettings)
        .values({ firstMonth: dto.firstMonth });
    });

    await this.ensureDuePeriods();

    return this.getSettings(actor);
  }

  /**
   * Lấy tài sản kèm cấu hình khấu hao
   */
  async listAssets(actor: AuthenticatedEmployee) {
    this.assertAction(actor, WORKFLOW_ACTIONS.depreciationView);

    return this.db
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
      ) // LEFT JOIN để lấy cả tài sản chưa có cấu hình khấu hao
      .orderBy(asc(schema.assets.assetCode));
  }

  /**
   * Cấu hình tài sản
   */
  async configureAsset(
    assetId: string,
    dto: DepreciationProfileDto,
    actor: AuthenticatedEmployee,
  ) {
    this.assertAction(actor, WORKFLOW_ACTIONS.depreciationPrepare);

    // Bắt đầu giao dịch (transaction)
    return this.db.transaction(async (tx) => {
      await this.lock(tx);
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

      // Kiểm tra:
      // 1. `firstMonth` truyền vào không được đứng trước tháng bắt đầu của hệ thống
      // 2. `firstMonth` truyền vào không được đứng trước tháng chứa `startDate`
      // 3. Thời gian khấu hao còn lại không thể lớn hơn tổng thời hạn
      // 4. Giá trị còn lại khi bắt đầu quản lý không được vượt nguyên giá
      // 5. Ngày dừng không được trước ngày bắt đầu khấu hao (chỉ kiểm tra khi có ngày dừng).
      // Ngày dừng là ngày cuối cùng tài sản được tính khấu hao khi cần dừng trước thời hạn dự kiến, ví dụ:
      // tài sản có lịch khấu hao đến hết năm 2030, nhưng Kế toán muốn dừng từ sau ngày 15/09/2026
      if (
        dto.firstMonth < settings.firstMonth ||
        dto.firstMonth < monthOf(dto.startDate) ||
        dto.remainingMonths > dto.termMonths ||
        BigInt(dto.openingValue) > BigInt(dto.originalCost) ||
        (dto.stopDate && dto.stopDate < dto.startDate)
      ) {
        throw new BadRequestException(
          'Kiểm tra lại tháng bắt đầu, ngày dừng, thời hạn và số dư đầu kỳ của tài sản.',
        );
      }

      // Kiểm tra xem có kỳ nào đang chờ duyệt không
      const [pending] = await tx
        .select({ id: schema.depreciationPeriods.id })
        .from(schema.depreciationPeriods)
        .where(eq(schema.depreciationPeriods.status, 'pending_approval'))
        .limit(1);

      // Nếu có thì không cho sửa cấu hình
      if (pending)
        throw new ConflictException(
          'Cần duyệt hoặc trả lại kỳ chờ duyệt trước khi sửa cấu hình.',
        );

      // Lấy cấu hình hiện tại của tài sản
      const [existing] = await tx
        .select()
        .from(schema.assetDepreciationProfiles)
        .where(eq(schema.assetDepreciationProfiles.assetId, assetId));

      // Lấy kỳ đã ghi nhận gần nhất
      const [latest] = await tx
        .select()
        .from(schema.depreciationPeriods)
        .where(eq(schema.depreciationPeriods.status, 'recorded'))
        .orderBy(desc(schema.depreciationPeriods.month))
        .limit(1);

      // Kiểm tra xem tài sản đã có khấu hao gắn với kỳ chưa
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
        // Nếu tài sản đã được ghi nhận và có profile, không được đổi các trường
        // changed dưới đây
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
        ((existing?.stopDate &&
          existing.stopDate < addMonths(latest.month, 1)) ||
          (values.stopDate && values.stopDate < addMonths(latest.month, 1)))
      ) {
        throw new ConflictException(
          'Ngày dừng phải sau kỳ đã ghi nhận gần nhất.',
        );
      }

      // Lưu dạng UPSERT:
      // Nếu chưa có profile thì INSERT
      // Đã có thì UPDATE
      // và trả về dòng vừa lưu vào db
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

  /**
   * Tạo các kỳ đã đến hạn
   */
  async ensureDuePeriods(now = new Date()) {
    return this.db.transaction(async (tx) => {
      await this.lock(tx);
      const [settings] = await tx.select().from(schema.depreciationSettings);

      if (!settings) return;

      // Kỳ đến hạn
      const due = lastDueMonth(now);

      // Duyệt từng tháng từ `firstMonth` đến kỳ đến hạn
      for (
        let month = settings.firstMonth;
        month <= due;
        month = addMonths(month, 1)
      ) {
        // Thêm kỳ nếu chưa có
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

  /**
   * Lấy danh sách kỳ và tổng tiền
   */
  async findAll(actor: AuthenticatedEmployee) {
    this.assertAction(actor, WORKFLOW_ACTIONS.depreciationView);
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

  /**
   * Lấy chi tiết kỳ và lịch sử
   */
  async findOne(id: string, actor: AuthenticatedEmployee) {
    this.assertAction(actor, WORKFLOW_ACTIONS.depreciationView);
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

  /**
   * Tính lại kỳ nháp
   */
  async recalculate(id: string, actor: AuthenticatedEmployee) {
    this.assertAction(actor, WORKFLOW_ACTIONS.depreciationPrepare);
    await this.db.transaction(async (tx) => {
      await this.lock(tx);
      const period = await this.requirePeriod(tx, id, 'draft');

      await this.assertPreviousRecorded(tx, period.month);
      await this.calculate(tx, period);
    });

    return this.findOne(id, actor);
  }

  /**
   * Gửi duyệt
   */
  async submit(id: string, actor: AuthenticatedEmployee) {
    this.assertAction(actor, WORKFLOW_ACTIONS.depreciationPrepare);
    await this.db.transaction(async (tx) => {
      await this.lock(tx);
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

  /**
   * Hàm dùng chung để quyết định trả hoặc duyệt ghi nhận
   */
  async decide(
    id: string,
    dto: DepreciationDecisionDto,
    actor: AuthenticatedEmployee,
  ) {
    this.assertAction(actor, WORKFLOW_ACTIONS.depreciationApprove);
    const reason = dto.reason?.trim();

    // Kiểm tra phải có lý do khi quyết định trả
    if (dto.decision === 'return' && !reason)
      throw new BadRequestException('Nhập lý do trả lại kỳ khấu hao.');

    await this.db.transaction(async (tx) => {
      await this.lock(tx);
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

  /**
   * Lấy kỳ và xác nhận trạng thái của kỳ
   */
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

  /**
   * Kiểm tra xem tài sản có kỳ trước đó không
   */
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

  /**
   * Hàm ném lỗi nếu tài sản có kỳ trước đó
   */
  private async assertPreviousRecorded(tx: Transaction, month: string) {
    if (await this.hasEarlierOpenPeriod(tx, month))
      throw new ConflictException(
        'Ghi nhận kỳ trước trước khi tính hoặc gửi duyệt kỳ này.',
      );
  }

  /**
   * Dựng bản tính cho từng tài sản
   */
  private async buildLines(
    tx: Transaction,
    month: string,
  ): Promise<schema.DepreciationLine[]> {
    // Lấy các tài sản có profile
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
      ) // INNER JOIN: chỉ lấy các tài sản được cấu hình
      .orderBy(asc(schema.assets.id));

    // Lấy số dư từ lịch sử các kỳ đã ghi nhận trước tháng đang tính
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

  /**
   * Tính và lưu
   */
  private async calculate(tx: Transaction, period: Period) {
    const lines = await this.buildLines(tx, period.month);

    await tx
      .update(schema.depreciationPeriods)
      .set({ lines, calculatedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.depreciationPeriods.id, period.id));
  }

  /**
   * Kiểm tra xem bản tính còn hợp lệ hay không,
   * bị chặn khi: kỳ chưa được tính lần nào,
   * hoặc bản tính trước đó khác bản tính dựng từ data hiện tại
   */
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
