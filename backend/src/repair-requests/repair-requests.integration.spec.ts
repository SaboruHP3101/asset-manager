import { ConflictException } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AssetRecallRequestsService } from '../asset-recall-requests/asset-recall-requests.service.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import * as schema from '../db/schema.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { RepairRequestsService } from './repair-requests.service.js';

const connectionString = process.env.REPAIR_TEST_DATABASE_URL;

describe.skipIf(!connectionString)(
  'repair and recall creation on PostgreSQL',
  () => {
    let pool: Pool;
    let db: NodePgDatabase<typeof schema>;
    let actor: AuthenticatedEmployee;
    let assetId: string;

    beforeAll(async () => {
      const url = new URL(connectionString!);

      if (url.hostname !== '127.0.0.1' || url.pathname !== '/repair_test') {
        throw new Error('Use a fresh disposable local repair_test database.');
      }

      pool = new Pool({ connectionString });
      db = drizzle(pool, { schema });
      await migrate(db, { migrationsFolder: './drizzle' });

      const [department] = await db
        .insert(schema.departments)
        .values({ name: 'REPAIR_TEST' })
        .returning();
      const [employee] = await db
        .insert(schema.employees)
        .values({
          employeeCode: 'REPAIR-TEST',
          fullName: 'Repair reporter',
          email: 'repair-test@example.test',
          departmentId: department.id,
        })
        .returning();
      const [category] = await db
        .insert(schema.assetCategories)
        .values({
          code: 'REPAIR-TEST',
          name: 'Test equipment',
          managementOwner: 'it',
        })
        .returning();
      const [supplier] = await db
        .insert(schema.suppliers)
        .values({
          supplierCode: 'REPAIR-TEST',
          taxCode: 'REPAIR-TEST',
          legalName: 'Test supplier',
          status: 'active',
        })
        .returning();
      const [asset] = await db
        .insert(schema.assets)
        .values({
          assetCode: 'REPAIR-TEST',
          qrCode: 'REPAIR-TEST',
          assetCategoryId: category.id,
          supplierId: supplier.id,
          currentUserId: employee.id,
          currentManagingDepartmentId: department.id,
          status: 'active',
          initialValue: '1',
          purchaseDate: '2026-11-01',
          inServiceDate: '2026-11-01',
        })
        .returning();

      actor = {
        id: employee.id,
        email: employee.email,
        departmentId: department.id,
        departmentName: department.name,
        isDepartmentHead: false,
      };
      assetId = asset.id;
    }, 30_000);

    afterAll(async () => {
      await pool?.end();
    });

    it('rechecks open requests after a concurrent recall releases the asset lock', async () => {
      const audit = new RequestAuditService(db);
      const recalls = new AssetRecallRequestsService(db, audit);
      const repairStarted = vi.fn();
      const repairDb = drizzle(pool, {
        schema,
        logger: {
          logQuery(query) {
            if (/for update|^insert into "repair_requests"/i.test(query)) {
              repairStarted();
            }
          },
        },
      });
      const repairs = new RepairRequestsService(repairDb, audit);
      const writeAudit = audit.log.bind(audit);
      let releaseRecall!: () => void;
      const recallMayCommit = new Promise<void>((resolve) => {
        releaseRecall = resolve;
      });
      const log = vi
        .spyOn(audit, 'log')
        .mockImplementation(async (tx, entry) => {
          await writeAudit(tx, entry);

          if (entry.actionType === 'asset.recall.draft_created') {
            await recallMayCommit;
          }
        });
      const recall = recalls.create({ assetId, type: 'exchange' }, actor);
      const recallResult = Promise.allSettled([recall]);

      try {
        await vi.waitFor(() => expect(log).toHaveBeenCalled());
        const repair = repairs.createMine(
          actor,
          { assetId, issueDescription: 'Broken' },
          [],
        );
        const repairResult = Promise.allSettled([repair]);

        try {
          // The recall has inserted a draft and still holds the lock.
          await vi.waitFor(() => expect(repairStarted).toHaveBeenCalled());
        } finally {
          releaseRecall();
          await repairResult;
        }

        await expect(repair).rejects.toThrow(ConflictException);
      } finally {
        releaseRecall();
        await recallResult;
      }

      await expect(recall).resolves.toMatchObject({ assetId, status: 'draft' });
      expect(await db.select().from(schema.repairRequests)).toHaveLength(0);
      expect(await db.select().from(schema.assetRecallRequests)).toHaveLength(
        1,
      );
    });
  },
);
