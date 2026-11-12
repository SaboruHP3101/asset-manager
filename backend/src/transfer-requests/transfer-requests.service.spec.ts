import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { TransferRequestsService } from './transfer-requests.service.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';

describe('TransferRequestsService', () => {
  let service: TransferRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferRequestsService,
        { provide: DRIZZLE, useValue: {} },
        { provide: RequestAuditService, useValue: { log: vi.fn() } },
      ],
    }).compile();

    service = module.get(TransferRequestsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('rejects a duplicate signature after waiting for the request lock', async () => {
    let release!: () => void;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = {
      id: 'transfer',
      status: 'handoff_pending',
      initiatedBy: 'sender',
      senderConfirmedAt: null as Date | null,
    };
    const db = {
      execute: vi.fn(() => lock),
      select: vi.fn(() => ({ from: () => ({ where: async () => [current] }) })),
      update: vi.fn(),
      transaction: (run: (tx: unknown) => Promise<unknown>) => run(db),
    };
    const subject = new TransferRequestsService(
      db as never,
      {} as RequestAuditService,
    );
    const pending = subject.confirmHandoff(current.id, {
      id: 'sender',
    } as AuthenticatedEmployee);
    const assertion = expect(pending).rejects.toThrow('Bên giao đã xác nhận');

    expect(db.select).not.toHaveBeenCalled();
    current.senderConfirmedAt = new Date();
    release();
    await assertion;
    expect(db.update).not.toHaveBeenCalled();
  });
});
