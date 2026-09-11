import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrderRequestsController } from './purchase-order-requests.controller.js';
import { PurchaseOrderRequestsService } from './purchase-order-requests.service.js';

describe('PurchaseOrderRequestsController', () => {
  let controller: PurchaseOrderRequestsController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrderRequestsController],
      providers: [{ provide: PurchaseOrderRequestsService, useValue: {} }],
    }).compile();
    controller = module.get<PurchaseOrderRequestsController>(
      PurchaseOrderRequestsController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
