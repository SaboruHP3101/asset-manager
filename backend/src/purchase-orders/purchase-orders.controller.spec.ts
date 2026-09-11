import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

describe('PurchaseOrdersController', () => {
  let controller: PurchaseOrdersController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrdersController],
      providers: [{ provide: PurchaseOrdersService, useValue: {} }],
    }).compile();
    controller = module.get<PurchaseOrdersController>(PurchaseOrdersController);
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
