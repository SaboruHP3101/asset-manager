import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { RepairRequestsService } from './repair-requests.service.js';

describe('RepairRequestsService', () => {
  let service: RepairRequestsService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RepairRequestsService, { provide: DRIZZLE, useValue: {} }],
    }).compile();
    service = module.get<RepairRequestsService>(RepairRequestsService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
