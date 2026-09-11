import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { PurchaseOrderRequestsService } from './purchase-order-requests.service.js';

describe('PurchaseOrderRequestsService', () => {
  let service: PurchaseOrderRequestsService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderRequestsService,
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();
    service = module.get<PurchaseOrderRequestsService>(
      PurchaseOrderRequestsService,
    );
  });
  it('should be defined', () => expect(service).toBeDefined());
});
