import { Test, TestingModule } from '@nestjs/testing';
import { AssetCategoriesController } from './asset-categories.controller.js';
import { AssetCategoriesService } from './asset-categories.service.js';

describe('AssetCategoriesController', () => {
  let controller: AssetCategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetCategoriesController],
      providers: [
        {
          provide: AssetCategoriesService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<AssetCategoriesController>(
      AssetCategoriesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
