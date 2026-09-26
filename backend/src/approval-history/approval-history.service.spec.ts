import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { ApprovalHistoryService } from './approval-history.service.js';

describe('ApprovalHistoryService', () => {
  let service: ApprovalHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApprovalHistoryService, { provide: DRIZZLE, useValue: {} }],
    }).compile();

    service = module.get<ApprovalHistoryService>(ApprovalHistoryService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
