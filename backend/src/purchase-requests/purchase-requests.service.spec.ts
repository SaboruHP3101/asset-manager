import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';

describe('PurchaseRequestsService', () => {
  let service: PurchaseRequestsService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchaseRequestsService, { provide: DRIZZLE, useValue: {} }],
    }).compile();
    service = module.get<PurchaseRequestsService>(PurchaseRequestsService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
