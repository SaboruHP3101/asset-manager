import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { BadRequestException } from '@nestjs/common';

describe('PurchaseRequestsService', () => {
  let service: PurchaseRequestsService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseRequestsService,
        { provide: DRIZZLE, useValue: {} },
        { provide: RequestAuditService, useValue: { log: vi.fn() } },
      ],
    }).compile();
    service = module.get<PurchaseRequestsService>(PurchaseRequestsService);
  });
  it('should be defined', () => expect(service).toBeDefined());

  it('không cho gửi lại yêu cầu đã submitted', async () => {
    const audit = { log: vi.fn() };
    const db = {
      transaction: vi.fn((callback) => callback(db)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi
            .fn()
            .mockResolvedValue([{ id: 'request-id', status: 'submitted' }]),
        })),
      })),
    };
    const workflow = new PurchaseRequestsService(
      db as never,
      audit as unknown as RequestAuditService,
    );

    await expect(
      workflow.submit('request-id', {
        id: 'actor-id',
        email: 'actor@example.com',
        roleId: 'role-id',
        roleName: 'Nhân viên',
        departmentId: 'department-id',
        isDepartmentHead: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.log).not.toHaveBeenCalled();
  });
});
