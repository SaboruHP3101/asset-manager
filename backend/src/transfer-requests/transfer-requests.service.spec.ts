import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RequestAuditService } from '../request-audit/request-audit.service.js';
import { TransferRequestsService } from './transfer-requests.service.js';

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
});
