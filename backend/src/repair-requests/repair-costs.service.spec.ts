import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { changeHistory, repairRequests } from '../db/schema.js';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RepairCostsService } from './repair-costs.service.js';

describe('RepairCostsService', () => {
  it('không cho phép tài khoản ngoài phòng IT đọc chi phí sửa chữa', async () => {
    const module = await Test.createTestingModule({
      providers: [RepairCostsService, { provide: DRIZZLE, useValue: {} }],
    }).compile();
    const service = module.get(RepairCostsService);
    const actor: AuthenticatedEmployee = {
      id: 'employee',
      email: 'employee@example.test',
      roleId: 'role',
      roleName: 'IT',
      departmentId: 'department',
      departmentName: 'WAREHOUSE',
      isDepartmentHead: false,
    };

    await expect(service.listCosts('2026-11', actor)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.updateCost(
        'repair',
        { cost: '1', previousCost: null, reason: 'test' },
        actor,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.listCostHistory('asset', actor)).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('updateCost', () => {
    const requestId = 'repair';
    const actorId = 'employee';
    const actor: AuthenticatedEmployee = {
      id: actorId,
      email: 'it@example.test',
      roleId: 'role',
      roleName: 'EMPLOYEE',
      departmentId: 'it',
      departmentName: 'IT',
      isDepartmentHead: false,
    };
    const dto = {
      previousCost: '4900000',
      cost: '4500000',
      reason: '  Sửa theo hóa đơn  ',
    };
    const lock = vi.fn();
    const set = vi.fn();
    const values = vi.fn();
    const tx = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ for: lock }) }) })),
      update: vi.fn(() => ({ set })),
      insert: vi.fn(() => ({ values })),
    };
    let service: RepairCostsService;

    beforeEach(async () => {
      vi.clearAllMocks();
      lock.mockResolvedValue([{ cost: dto.previousCost }]);
      set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      const module = await Test.createTestingModule({
        providers: [
          RepairCostsService,
          {
            provide: DRIZZLE,
            useValue: {
              transaction: (run: (db: typeof tx) => Promise<void>) => run(tx),
            },
          },
        ],
      }).compile();

      service = module.get(RepairCostsService);
    });

    it('lưu chi phí và lý do sau khi khóa phiếu', async () => {
      await service.updateCost(requestId, dto, actor);

      expect(lock).toHaveBeenCalledWith('update');
      expect(lock).toHaveBeenCalledBefore(tx.update);
      expect(tx.update).toHaveBeenCalledWith(repairRequests);
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({ repairCost: dto.cost, updatedBy: actorId }),
      );
      expect(tx.insert).toHaveBeenCalledWith(changeHistory);
      expect(values).toHaveBeenCalledWith({
        entityType: 'repair_request',
        entityId: requestId,
        action: 'update_cost',
        oldData: { repairCost: dto.previousCost },
        newData: { repairCost: dto.cost, reason: 'Sửa theo hóa đơn' },
        performedByEmployeeId: actorId,
      });
    });

    it('từ chối nếu số tiền trước đã thay đổi', async () => {
      lock.mockResolvedValue([{ cost: '4800000' }]);

      await expect(service.updateCost(requestId, dto, actor)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.update).not.toHaveBeenCalled();
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('từ chối khi không có phiếu đã nghiệm thu', async () => {
      lock.mockResolvedValue([]);

      await expect(service.updateCost(requestId, dto, actor)).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('không ghi thêm lịch sử khi gửi lại cùng số tiền', async () => {
      lock.mockResolvedValue([{ cost: dto.cost }]);

      await service.updateCost(requestId, dto, actor);

      expect(tx.update).not.toHaveBeenCalled();
      expect(tx.insert).not.toHaveBeenCalled();
    });
  });
});
