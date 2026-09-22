import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedEmployee } from './workflow-auth.types.js';
import { PurchaseAuthorizationService } from './purchase-authorization.service.js';

const actor: AuthenticatedEmployee = {
  id: 'employee-id',
  email: 'employee@example.com',
  roleId: 'role-id',
  roleName: 'EMPLOYEE',
  departmentId: 'department-id',
  departmentName: 'WAREHOUSE',
  isDepartmentHead: false,
};

describe('PurchaseAuthorizationService', () => {
  const service = new PurchaseAuthorizationService({} as never);

  it('chỉ cho requester thao tác request của mình', () => {
    expect(() =>
      service.assertOwnRequest(actor, {
        requesterId: actor.id,
        departmentId: actor.departmentId,
      }),
    ).not.toThrow();
    expect(() =>
      service.assertOwnRequest(actor, {
        requesterId: 'another-id',
        departmentId: actor.departmentId,
      }),
    ).toThrow(ForbiddenException);
  });

  it('chỉ cho trưởng phòng xử lý request cùng phòng', () => {
    const head = { ...actor, isDepartmentHead: true };

    expect(() =>
      service.assertDepartmentRequest(head, {
        requesterId: 'another-id',
        departmentId: head.departmentId,
      }),
    ).not.toThrow();
    expect(() =>
      service.assertDepartmentRequest(head, {
        requesterId: 'another-id',
        departmentId: 'another-department',
      }),
    ).toThrow(ForbiddenException);
  });

  it('khớp management owner với đúng phòng chuyên môn', () => {
    expect(() =>
      service.assertManagementOwner({ ...actor, departmentName: 'IT' }, 'it'),
    ).not.toThrow();
    expect(() =>
      service.assertManagementOwner(
        { ...actor, departmentName: 'PROCUREMENT' },
        'it',
      ),
    ).toThrow(ForbiddenException);
  });

  it('từ chối xem timeline purchase ngoài phạm vi', async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              requesterId: 'another-id',
              departmentId: 'another-department',
              status: 'pending_department_head',
              currentRevision: 1,
            },
          ]),
        })),
      })),
    };
    const scopedService = new PurchaseAuthorizationService(db as never);

    await expect(
      scopedService.assertCanViewRequest('request-id', actor),
    ).rejects.toThrow(ForbiddenException);
  });
});
