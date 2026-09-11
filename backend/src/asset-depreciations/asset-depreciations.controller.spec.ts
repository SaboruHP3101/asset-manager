import { Test, TestingModule } from '@nestjs/testing';
import { AssetDepreciationsController } from './asset-depreciations.controller.js';
import { AssetDepreciationsService } from './asset-depreciations.service.js';

describe('AssetDepreciationsController', () => {
  let controller: AssetDepreciationsController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetDepreciationsController],
      providers: [{ provide: AssetDepreciationsService, useValue: {} }],
    }).compile();
    controller = module.get<AssetDepreciationsController>(
      AssetDepreciationsController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
