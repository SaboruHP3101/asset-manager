import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AssetsService } from './assets.service.js';

describe('AssetsService', () => {
  let service: AssetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssetsService, { provide: DRIZZLE, useValue: {} }],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
