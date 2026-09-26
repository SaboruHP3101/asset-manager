import { Test, TestingModule } from '@nestjs/testing';
import { SupplierAddressesController } from './supplier-addresses.controller.js';
import { SupplierAddressesService } from './supplier-addresses.service.js';

describe('SupplierAddressesController', () => {
  let controller: SupplierAddressesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupplierAddressesController],
      providers: [{ provide: SupplierAddressesService, useValue: {} }],
    }).compile();

    controller = module.get<SupplierAddressesController>(
      SupplierAddressesController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
