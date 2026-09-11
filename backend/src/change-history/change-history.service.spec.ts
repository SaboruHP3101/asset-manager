import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { ChangeHistoryService } from './change-history.service.js';

describe('ChangeHistoryService', () => {
  let service: ChangeHistoryService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChangeHistoryService, { provide: DRIZZLE, useValue: {} }],
    }).compile();
    service = module.get<ChangeHistoryService>(ChangeHistoryService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
