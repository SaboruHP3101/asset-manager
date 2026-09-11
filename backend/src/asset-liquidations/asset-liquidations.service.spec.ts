import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AssetLiquidationsService } from './asset-liquidations.service.js';

describe('AssetLiquidationsService', () => {
  let service: AssetLiquidationsService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssetLiquidationsService, { provide: DRIZZLE, useValue: {} }],
    }).compile();
    service = module.get<AssetLiquidationsService>(AssetLiquidationsService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
