import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AssetLiquidationItemsService } from './asset-liquidation-items.service.js';

describe('AssetLiquidationItemsService', () => {
  let service: AssetLiquidationItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetLiquidationItemsService,
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();

    service = module.get<AssetLiquidationItemsService>(
      AssetLiquidationItemsService,
    );
  });
  it('should be defined', () => expect(service).toBeDefined());
});
