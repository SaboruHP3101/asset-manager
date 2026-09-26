import { Test, TestingModule } from '@nestjs/testing';
import { AssetInventoriesController } from './asset-inventories.controller.js';
import { AssetInventoriesService } from './asset-inventories.service.js';

describe('AssetInventoriesController', () => {
  let controller: AssetInventoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetInventoriesController],
      providers: [{ provide: AssetInventoriesService, useValue: {} }],
    }).compile();

    controller = module.get<AssetInventoriesController>(
      AssetInventoriesController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
