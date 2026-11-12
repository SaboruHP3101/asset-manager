import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { WORKFLOW_ACTIONS } from '../auth/workflow-actions.config.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { assets, assetHandoverHistory, repairRequests } from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { RepairRequestsService } from './repair-requests.service.js';
import { removeUploadedFiles } from '../attachments/upload-cleanup.js';

vi.mock('../attachments/upload-cleanup.js', () => ({
  removeUploadedFiles: vi.fn(),
}));

const reporter: AuthenticatedEmployee = {
  id: 'reporter',
  email: 'reporter@example.test',
  roleId: 'role',
  roleName: 'EMPLOYEE',
  departmentId: 'operations',
  departmentName: 'OPERATIONS',
  isDepartmentHead: false,
};
const technician: AuthenticatedEmployee = {
  ...reporter,
  id: 'technician',
  departmentId: 'it',
  departmentName: 'IT',
};
const itHead = { ...technician, id: 'it-head', isDepartmentHead: true };
const repair = {
  id: 'repair',
  assetId: 'asset',
  reporterId: reporter.id,
  departmentId: reporter.departmentId,
  assignedTo: technician.id,
  status: 'in_progress',
  currentRevision: 1,
};
const assignedAsset = {
  id: repair.assetId,
  currentUserId: reporter.id,
  managementOwner: 'it',
};
const warehouse = {
  id: 'warehouse',
  managingDepartmentId: itHead.departmentId,
};

describe('RepairRequestsService', () => {
  const orderBy = vi.fn();
  const where = vi.fn();
  const returning = vi.fn();
  const set = vi.fn();
  const values = vi.fn();
  const audit = { log: vi.fn(), findTrail: vi.fn() };
  const tx = {
    execute: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };
  let service: RepairRequestsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const selectQuery = {
      from: vi.fn(() => selectQuery),
      innerJoin: vi.fn(() => selectQuery),
      where,
    };

    tx.select.mockReturnValue(selectQuery);
    tx.update.mockReturnValue({ set });
    tx.insert.mockReturnValue({ values });
    set.mockReturnValue({ where: () => ({ returning }) });
    audit.findTrail.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        RepairRequestsService,
        {
          provide: DRIZZLE,
          useValue: {
            select: tx.select,
            transaction: (run: (db: typeof tx) => Promise<unknown>) => run(tx),
          },
        },
        { provide: RequestAuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(RepairRequestsService);
  });

  it('khóa tài sản trước khi kiểm tra phiếu đang mở và từ chối nếu đang thu hồi', async () => {
    where
      .mockResolvedValueOnce([assignedAsset])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'recall' }]);

    await expect(
      service.createMine(
        reporter,
        { assetId: repair.assetId, issueDescription: 'Thiết bị hỏng' },
        [],
      ),
    ).rejects.toThrow(ConflictException);

    expect(tx.execute).toHaveBeenCalledBefore(tx.select);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('removes uploaded evidence when repair creation is rejected', async () => {
    where.mockResolvedValueOnce([]);
    const evidence = {
      path: 'unused-repair-evidence.png',
    } as Express.Multer.File;

    await expect(
      service.createMine(
        reporter,
        {
          assetId: repair.assetId,
          issueDescription: 'Broken',
        },
        [evidence],
      ),
    ).rejects.toThrow();

    expect(removeUploadedFiles).toHaveBeenCalledWith([evidence]);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it.each([
    {
      actor: reporter,
      employeeDecision: 'confirmed',
      itDecision: 'pending',
      movesAsset: false,
    },
    {
      actor: itHead,
      employeeDecision: 'confirmed',
      itDecision: 'confirmed',
      movesAsset: true,
    },
  ])(
    'chỉ chuyển kho khi cả hai bên đã xác nhận ($actor.id)',
    async ({ actor, employeeDecision, itDecision, movesAsset }) => {
      const pending = {
        ...repair,
        status: 'pending_handover_confirmations',
        employeeHandoverDecision: movesAsset ? 'confirmed' : 'pending',
        itHandoverDecision: 'pending',
      };
      const updated = {
        ...pending,
        employeeHandoverDecision: employeeDecision,
        itHandoverDecision: itDecision,
      };

      where.mockResolvedValueOnce([pending]);

      if (movesAsset) {
        where
          .mockResolvedValueOnce([assignedAsset])
          .mockResolvedValueOnce([warehouse]);
      }

      where
        .mockResolvedValueOnce([
          { ...updated, status: movesAsset ? 'in_progress' : pending.status },
        ])
        .mockResolvedValueOnce([assignedAsset]);
      returning.mockResolvedValueOnce([updated]);

      const result = await service.decideHandover(
        repair.id,
        { confirmed: true },
        actor,
      );

      expect(result.status).toBe(movesAsset ? 'in_progress' : pending.status);
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining(
          movesAsset
            ? { itHandoverDecision: 'confirmed' }
            : { employeeHandoverDecision: 'confirmed' },
        ),
      );

      if (movesAsset) {
        expect(tx.update).toHaveBeenCalledWith(assets);
        expect(tx.insert).toHaveBeenCalledWith(assetHandoverHistory);
        expect(set).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'repairing',
            currentWarehouseId: warehouse.id,
            currentUserId: null,
          }),
        );
      } else {
        expect(tx.update).not.toHaveBeenCalledWith(assets);
        expect(tx.insert).not.toHaveBeenCalled();
      }
    },
  );

  it('trả phiếu về chỉnh sửa khi một bên từ chối bàn giao', async () => {
    const pending = {
      ...repair,
      status: 'pending_handover_confirmations',
      employeeHandoverDecision: 'confirmed',
      itHandoverDecision: 'pending',
    };
    const rejected = {
      ...pending,
      status: 'revision_required',
      itHandoverDecision: 'rejected',
    };

    where
      .mockResolvedValueOnce([pending])
      .mockResolvedValueOnce([rejected])
      .mockResolvedValueOnce([assignedAsset]);
    returning.mockResolvedValueOnce([rejected]);

    await service.decideHandover(
      repair.id,
      { confirmed: false, note: '  Sai thiết bị  ' },
      itHead,
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'revision_required',
        itHandoverDecision: 'rejected',
        itHandoverNote: 'Sai thiết bị',
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actionType: 'repair.it_handover_rejected',
        newStatus: 'revision_required',
        notes: '  Sai thiết bị  ',
      }),
    );
    expect(tx.update).toHaveBeenCalledExactlyOnceWith(repairRequests);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('giữ tài sản trong kho IT khi người báo từ chối nghiệm thu', async () => {
    where
      .mockResolvedValueOnce([{ ...repair, status: 'ready_for_return' }])
      .mockResolvedValueOnce([warehouse])
      .mockResolvedValueOnce([
        {
          id: repair.assetId,
          currentWarehouseId: warehouse.id,
          currentUserId: null,
          status: 'repairing',
        },
      ]);
    returning.mockResolvedValueOnce([repair]);

    await service.confirmResult(
      repair.id,
      { accepted: false, note: 'Vẫn hỏng' },
      reporter,
    );

    expect(tx.update).toHaveBeenCalledExactlyOnceWith(repairRequests);
    expect(tx.insert).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'in_progress',
        confirmationStatus: 'rejected',
        repairCost: null,
        closedAt: null,
      }),
    );
  });

  it.each([
    { actor: technician, canComplete: true },
    { actor: { ...technician, id: 'other-technician' }, canComplete: false },
  ])(
    'dùng người được phân công cho queue, nút và thao tác hoàn tất ($actor.id)',
    async ({ actor, canComplete }) => {
      where
        .mockReturnValueOnce({ orderBy })
        .mockResolvedValueOnce([repair])
        .mockResolvedValueOnce([assignedAsset])
        .mockResolvedValueOnce([repair]);
      orderBy.mockResolvedValueOnce([]);
      returning.mockResolvedValueOnce([
        { ...repair, status: 'ready_for_return' },
      ]);

      await service.findQueue(actor);
      const [condition] = where.mock.calls[0] as [SQL];
      const queue = new PgDialect().sqlToQuery(condition);

      expect(queue.sql).toMatch(
        /"repair_requests"\."status" = \$1 and "repair_requests"\."assigned_to" = \$2/,
      );
      expect(queue.params.slice(0, 2)).toEqual(['in_progress', actor.id]);

      const detail = await service.findOneForActor(repair.id, actor);

      expect(
        detail.allowedActions.includes(WORKFLOW_ACTIONS.repairComplete),
      ).toBe(canComplete);

      const complete = service.complete(
        repair.id,
        { resultNotes: 'Đã sửa' },
        actor,
      );

      if (canComplete) {
        await expect(complete).resolves.toMatchObject({
          status: 'ready_for_return',
        });
      } else {
        await expect(complete).rejects.toThrow(ForbiddenException);
        expect(tx.update).not.toHaveBeenCalled();
      }
    },
  );
});
