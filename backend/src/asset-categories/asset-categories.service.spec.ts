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

  it('returns only categories configured as purchase options', async () => {
    const rows = [
      {
        id: 'computers-id',
        code: 'MT',
        name: 'Máy tính',
        isPurchaseOption: true,
      },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const filteredService = new AssetCategoriesService({
      select: vi.fn(() => ({ from })),
    } as never);

    const result = await filteredService.findPurchaseOptions();

    expect(where).toHaveBeenCalledOnce();
    expect(orderBy).toHaveBeenCalledOnce();
    expect(result).toEqual([
      expect.objectContaining({
        id: 'computers-id',
        name: 'Máy tính',
        isPurchaseOption: true,
      }),
    ]);
  });
});
