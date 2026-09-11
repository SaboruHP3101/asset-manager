import { Test, TestingModule } from '@nestjs/testing';
import { ChangeHistoryController } from './change-history.controller.js';
import { ChangeHistoryService } from './change-history.service.js';

describe('ChangeHistoryController', () => {
  let controller: ChangeHistoryController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangeHistoryController],
      providers: [{ provide: ChangeHistoryService, useValue: {} }],
    }).compile();
    controller = module.get<ChangeHistoryController>(ChangeHistoryController);
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
