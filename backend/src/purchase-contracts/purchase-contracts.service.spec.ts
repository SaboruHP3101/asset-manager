import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { PurchaseContractsService } from './purchase-contracts.service.js';

describe('PurchaseContractsService', () => {
  let service: PurchaseContractsService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchaseContractsService, { provide: DRIZZLE, useValue: {} }],
    }).compile();
    service = module.get<PurchaseContractsService>(PurchaseContractsService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
