import { Test, TestingModule } from '@nestjs/testing';
import { AssetLiquidationsController } from './asset-liquidations.controller.js';
import { AssetLiquidationsService } from './asset-liquidations.service.js';

describe('AssetLiquidationsController', () => {
  let controller: AssetLiquidationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetLiquidationsController],
      providers: [{ provide: AssetLiquidationsService, useValue: {} }],
    }).compile();

    controller = module.get<AssetLiquidationsController>(
      AssetLiquidationsController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
