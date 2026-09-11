import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AssetInventoriesService } from './asset-inventories.service.js';

describe('AssetInventoriesService', () => {
  let service: AssetInventoriesService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssetInventoriesService, { provide: DRIZZLE, useValue: {} }],
    }).compile();
    service = module.get<AssetInventoriesService>(AssetInventoriesService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
