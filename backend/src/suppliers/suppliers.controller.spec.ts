import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

describe('SuppliersController', () => {
  let controller: SuppliersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [{ provide: SuppliersService, useValue: {} }],
    }).compile();

    controller = module.get<SuppliersController>(SuppliersController);
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
