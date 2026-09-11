import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AssetCategoriesService } from './asset-categories.service.js';

describe('AssetCategoriesService', () => {
  let service: AssetCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssetCategoriesService, { provide: DRIZZLE, useValue: {} }],
    }).compile();

    service = module.get<AssetCategoriesService>(AssetCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
