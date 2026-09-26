import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AssetDepreciationsService } from './asset-depreciations.service.js';

describe('AssetDepreciationsService', () => {
  let service: AssetDepreciationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetDepreciationsService,
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();

    service = module.get<AssetDepreciationsService>(AssetDepreciationsService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
