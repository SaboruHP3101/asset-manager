import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseContractsController } from './purchase-contracts.controller.js';
import { PurchaseContractsService } from './purchase-contracts.service.js';

describe('PurchaseContractsController', () => {
  let controller: PurchaseContractsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseContractsController],
      providers: [{ provide: PurchaseContractsService, useValue: {} }],
    }).compile();

    controller = module.get<PurchaseContractsController>(
      PurchaseContractsController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
