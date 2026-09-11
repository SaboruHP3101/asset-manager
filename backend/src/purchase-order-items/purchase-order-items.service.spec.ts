import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { PurchaseOrderItemsService } from './purchase-order-items.service.js';

describe('PurchaseOrderItemsService', () => {
  let service: PurchaseOrderItemsService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderItemsService,
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();
    service = module.get<PurchaseOrderItemsService>(PurchaseOrderItemsService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
