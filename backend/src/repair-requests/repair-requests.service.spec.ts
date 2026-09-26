import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RepairRequestsService } from './repair-requests.service.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';

describe('RepairRequestsService', () => {
  let service: RepairRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairRequestsService,
        { provide: DRIZZLE, useValue: {} },
        { provide: RequestAuditService, useValue: { log: vi.fn() } },
      ],
    }).compile();

    service = module.get<RepairRequestsService>(RepairRequestsService);
  });
  it('should be defined', () => expect(service).toBeDefined());

  it('chuyển đánh giá không cần duyệt sang in_progress và ghi audit', async () => {
    const audit = { log: vi.fn() };
    const updated = { id: 'repair-id', status: 'in_progress' };
    const db = {
      transaction: vi.fn((callback) => callback(db)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi
            .fn()
            .mockResolvedValue([{ id: 'repair-id', status: 'reported' }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([updated]),
          })),
        })),
      })),
    };
    const workflow = new RepairRequestsService(
      db as never,
      audit as unknown as RequestAuditService,
    );

    const result = await workflow.assess(
      'repair-id',
      { notes: 'Thiết bị có thể sửa tại chỗ', needsApproval: false },
      {
        id: 'actor-id',
        email: 'it@example.com',
        roleId: 'role-id',
        roleName: 'IT',
        departmentId: 'department-id',
        departmentName: 'IT',
        isDepartmentHead: false,
      },
    );

    expect(result).toMatchObject(updated);
    expect(audit.log).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ actionType: 'assessed', status: 'approved' }),
    );
  });
});
