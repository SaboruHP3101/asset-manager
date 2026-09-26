import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module.js';
import { AttachmentsService } from './attachments.service.js';

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttachmentsService, { provide: DRIZZLE, useValue: {} }],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
