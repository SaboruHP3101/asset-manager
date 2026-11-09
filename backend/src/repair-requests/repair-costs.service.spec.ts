import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
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
    await expect(service.listCostHistory('asset', actor)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
