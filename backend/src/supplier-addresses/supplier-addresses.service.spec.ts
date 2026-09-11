import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { SupplierAddressesService } from './supplier-addresses.service.js';

describe('SupplierAddressesService', () => {
  let service: SupplierAddressesService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupplierAddressesService, { provide: DRIZZLE, useValue: {} }],
    }).compile();
    service = module.get<SupplierAddressesService>(SupplierAddressesService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
