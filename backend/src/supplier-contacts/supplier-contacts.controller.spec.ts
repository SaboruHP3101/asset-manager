import { Test, TestingModule } from '@nestjs/testing';
import { SupplierContactsController } from './supplier-contacts.controller.js';
import { SupplierContactsService } from './supplier-contacts.service.js';

describe('SupplierContactsController', () => {
  let controller: SupplierContactsController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupplierContactsController],
      providers: [{ provide: SupplierContactsService, useValue: {} }],
    }).compile();
    controller = module.get<SupplierContactsController>(
      SupplierContactsController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
