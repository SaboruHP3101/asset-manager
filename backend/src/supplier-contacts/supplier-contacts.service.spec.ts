import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { SupplierContactsService } from './supplier-contacts.service.js';

describe('SupplierContactsService', () => {
  let service: SupplierContactsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupplierContactsService, { provide: DRIZZLE, useValue: {} }],
    }).compile();

    service = module.get<SupplierContactsService>(SupplierContactsService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
