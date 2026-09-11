import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalHistoryController } from './approval-history.controller.js';
import { ApprovalHistoryService } from './approval-history.service.js';

describe('ApprovalHistoryController', () => {
  let controller: ApprovalHistoryController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApprovalHistoryController],
      providers: [{ provide: ApprovalHistoryService, useValue: {} }],
    }).compile();
    controller = module.get<ApprovalHistoryController>(
      ApprovalHistoryController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
