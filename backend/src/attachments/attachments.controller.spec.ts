import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';

describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [{ provide: AttachmentsService, useValue: {} }],
    }).compile();
    controller = module.get<AttachmentsController>(AttachmentsController);
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
