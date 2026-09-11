import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AssetHandoverHistoryService } from './asset-handover-history.service.js';

describe('AssetHandoverHistoryService', () => {
  let service: AssetHandoverHistoryService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetHandoverHistoryService,
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();
    service = module.get<AssetHandoverHistoryService>(
      AssetHandoverHistoryService,
    );
  });
  it('should be defined', () => expect(service).toBeDefined());
});
