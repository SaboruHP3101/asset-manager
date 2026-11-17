import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { vi } from 'vitest';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { AssetDepreciationsService } from './asset-depreciations.service.js';

const connectionString = process.env.DEPRECIATION_TEST_DATABASE_URL;

describe.skipIf(!connectionString)('depreciation PostgreSQL workflow', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: AssetDepreciationsService;
  let staff: AuthenticatedEmployee;
  let head: AuthenticatedEmployee;
  const firstAsset = '00000000-0000-4000-8000-000000000001';
  const secondAsset = '00000000-0000-4000-8000-000000000002';
  const profile = {
    originalCost: '60000000',
    openingValue: '60000000',
    firstMonth: '2026-09-01',
    startDate: '2026-09-01',
    termMonths: 60,
    remainingMonths: 60,
  };

  beforeAll(async () => {
    const url = new URL(connectionString!);

    if (url.pathname !== '/depreciation_test' || url.hostname !== '127.0.0.1')
      throw new Error(
        'Use a fresh disposable local depreciation_test database.',
      );

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 1, 0, 5));
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: './drizzle' });
    service = new AssetDepreciationsService(db);
    const [department] = await db
      .insert(schema.departments)
      .values({ name: 'ACCOUNTING' })
      .returning();
    const employees = await db
      .insert(schema.employees)
      .values([
        {
          employeeCode: 'TEST-STAFF',
          fullName: 'Accounting staff',
          email: 'staff@example.test',
          departmentId: department.id,
        },
        {
          employeeCode: 'TEST-HEAD',
          fullName: 'Accounting head',
          email: 'head@example.test',
          departmentId: department.id,
          isDepartmentHead: true,
        },
      ])
      .returning();

    staff = {
      id: employees[0].id,
      email: employees[0].email,
      departmentId: department.id,
      departmentName: 'ACCOUNTING',
      isDepartmentHead: false,
    };
    head = {
      ...staff,
      id: employees[1].id,
      email: employees[1].email,
      isDepartmentHead: true,
    };
    const [category] = await db
      .insert(schema.assetCategories)
      .values({ code: 'TEST', name: 'Test equipment' })
      .returning();
    const [supplier] = await db
      .insert(schema.suppliers)
      .values({
        supplierCode: 'TEST',
        taxCode: 'TEST',
        legalName: 'Test supplier',
        status: 'active',
      })
      .returning();

    await db.insert(schema.assets).values(
      [firstAsset, secondAsset].map((id, index) => ({
        id,
        assetCode: `TEST-${index}`,
        qrCode: `TEST-${index}`,
        name: `Asset ${index}`,
        assetCategoryId: category.id,
        supplierId: supplier.id,
        status: 'active',
        initialValue: '1',
        currentValue: '123',
        purchaseDate: '2026-09-01',
        inServiceDate: '2026-09-01',
      })),
    );
  }, 30_000);

  afterAll(async () => {
    service?.onModuleDestroy();
    await pool?.end();
    vi.useRealTimers();
  });

  it('creates drafts, enforces review, posts once, and rolls back partial postings', async () => {
    await service.initialize({ firstMonth: '2026-09-01' }, staff);
    await expect(
      service.initialize({ firstMonth: '2026-10-01' }, staff),
    ).rejects.toBeInstanceOf(ConflictException);
    await Promise.all([service.ensureDuePeriods(), service.ensureDuePeriods()]);
    const periods = await service.findAll(staff);
    const september = periods.find((period) => period.month === '2026-09-01')!;
    const october = periods.find((period) => period.month === '2026-10-01')!;

    expect(periods).toHaveLength(2);
    expect(periods.every((period) => period.status === 'draft')).toBe(true);
    await service.configureAsset(firstAsset, profile, staff);
    await service.configureAsset(
      secondAsset,
      {
        ...profile,
        originalCost: '12000',
        openingValue: '12000',
        termMonths: 12,
        remainingMonths: 12,
      },
      staff,
    );
    await expect(
      service.configureAsset(
        firstAsset,
        { ...profile, openingValue: '60000001' },
        staff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.recalculate(october.id, staff)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await service.recalculate(september.id, staff);
    await service.configureAsset(
      firstAsset,
      { ...profile, termMonths: 30, remainingMonths: 30 },
      staff,
    );
    await expect(service.submit(september.id, staff)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await service.configureAsset(firstAsset, profile, staff);
    const calculated = await service.recalculate(september.id, staff);

    expect(calculated.lines[0]).toMatchObject({
      openingValue: '60000000',
      depreciationAmount: '1000000',
    });
    expect(
      (
        await db
          .select()
          .from(schema.assets)
          .where(eq(schema.assets.id, firstAsset))
      )[0].currentValue,
    ).toBe('123');
    await service.submit(september.id, staff);
    await expect(
      service.configureAsset(firstAsset, profile, staff),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.recalculate(september.id, staff),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.decide(september.id, { decision: 'approve' }, staff),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.decide(september.id, { decision: 'return', reason: ' ' }, head),
    ).rejects.toBeInstanceOf(BadRequestException);
    const returned = await service.decide(
      september.id,
      { decision: 'return', reason: 'Please check' },
      head,
    );

    expect(returned).toMatchObject({
      status: 'draft',
      returnReason: 'Please check',
    });
    expect(await db.select().from(schema.assetDepreciations)).toHaveLength(0);
    await service.submit(september.id, staff);
    await expect(
      service.decide(
        september.id,
        { decision: 'approve' },
        { ...staff, isDepartmentHead: true },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const approvals = await Promise.allSettled([
      service.decide(september.id, { decision: 'approve' }, head),
      service.decide(september.id, { decision: 'approve' }, head),
    ]);

    expect(
      approvals.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      approvals.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(await db.select().from(schema.assetDepreciations)).toHaveLength(2);
    expect(
      (
        await db
          .select()
          .from(schema.assets)
          .where(eq(schema.assets.id, firstAsset))
      )[0].currentValue,
    ).toBe('59000000');
    expect((await service.findOne(september.id, staff)).history).toHaveLength(
      4,
    );
    await expect(
      service.configureAsset(
        firstAsset,
        { ...profile, termMonths: 30, remainingMonths: 30 },
        staff,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const octoberDraft = await service.recalculate(october.id, staff);

    expect(octoberDraft.lines[0].openingValue).toBe('59000000');
    await service.submit(october.id, staff);
    const [duplicate] = await db
      .insert(schema.assetDepreciations)
      .values({
        assetId: secondAsset,
        periodId: october.id,
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
        openingValue: '11000',
        depreciationAmount: '1000',
        remainingValue: '10000',
        depreciationMethod: 'straight_line',
      })
      .returning();

    await expect(
      service.decide(october.id, { decision: 'approve' }, head),
    ).rejects.toThrow();
    expect((await service.findOne(october.id, head)).status).toBe(
      'pending_approval',
    );
    expect(
      (
        await db
          .select()
          .from(schema.assets)
          .where(eq(schema.assets.id, firstAsset))
      )[0].currentValue,
    ).toBe('59000000');
    expect(
      await db
        .select()
        .from(schema.assetDepreciations)
        .where(
          and(
            eq(schema.assetDepreciations.periodId, october.id),
            eq(schema.assetDepreciations.assetId, firstAsset),
          ),
        ),
    ).toHaveLength(0);
    await db
      .delete(schema.assetDepreciations)
      .where(eq(schema.assetDepreciations.id, duplicate.id));
    await service.decide(october.id, { decision: 'approve' }, head);
    expect(
      (
        await db
          .select()
          .from(schema.assets)
          .where(eq(schema.assets.id, firstAsset))
      )[0].currentValue,
    ).toBe('58000000');

    await expect(
      service.configureAsset(
        firstAsset,
        { ...profile, stopDate: '2026-10-31' },
        staff,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await service.configureAsset(
      firstAsset,
      { ...profile, stopDate: '2026-11-15' },
      staff,
    );

    // A restart recovers missed months, but never before the configured rollout.
    await service.ensureDuePeriods(new Date(2027, 0, 1, 0, 5));
    const recovered = await db.select().from(schema.depreciationPeriods);

    expect(recovered.map((period) => period.month).sort()).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ]);
    const november = recovered.find((period) => period.month === '2026-11-01')!;

    expect(november.lines[0]).toMatchObject({
      depreciationAmount: '500000',
      remainingValue: '57500000',
    });
    await service.ensureDuePeriods(new Date(2027, 0, 1, 0, 5));
    expect(await db.select().from(schema.depreciationPeriods)).toHaveLength(4);
    await service.submit(november.id, staff);
    await service.decide(november.id, { decision: 'approve' }, head);
    await expect(
      service.configureAsset(firstAsset, { ...profile, stopDate: null }, staff),
    ).rejects.toBeInstanceOf(ConflictException);
  }, 30_000);
});
