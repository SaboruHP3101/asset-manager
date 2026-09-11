import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchaseOrdersService, { provide: DRIZZLE, useValue: {} }],
    }).compile();
    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
