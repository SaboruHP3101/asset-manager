import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseRequestsController } from './purchase-requests.controller.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';

describe('PurchaseRequestsController', () => {
  let controller: PurchaseRequestsController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseRequestsController],
      providers: [{ provide: PurchaseRequestsService, useValue: {} }],
    }).compile();
    controller = module.get<PurchaseRequestsController>(
      PurchaseRequestsController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
