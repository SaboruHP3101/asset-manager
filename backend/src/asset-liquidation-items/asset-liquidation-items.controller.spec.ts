import { Test, TestingModule } from '@nestjs/testing';
import { AssetLiquidationItemsController } from './asset-liquidation-items.controller.js';
import { AssetLiquidationItemsService } from './asset-liquidation-items.service.js';

describe('AssetLiquidationItemsController', () => {
  let controller: AssetLiquidationItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetLiquidationItemsController],
      providers: [{ provide: AssetLiquidationItemsService, useValue: {} }],
    }).compile();

    controller = module.get<AssetLiquidationItemsController>(
      AssetLiquidationItemsController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
