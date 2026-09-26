import { Test, TestingModule } from '@nestjs/testing';
import { AssetHandoverHistoryController } from './asset-handover-history.controller.js';
import { AssetHandoverHistoryService } from './asset-handover-history.service.js';

describe('AssetHandoverHistoryController', () => {
  let controller: AssetHandoverHistoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetHandoverHistoryController],
      providers: [{ provide: AssetHandoverHistoryService, useValue: {} }],
    }).compile();

    controller = module.get<AssetHandoverHistoryController>(
      AssetHandoverHistoryController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
