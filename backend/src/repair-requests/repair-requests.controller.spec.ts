import { Test, TestingModule } from '@nestjs/testing';
import { RepairRequestsController } from './repair-requests.controller.js';
import { RepairRequestsService } from './repair-requests.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { WorkflowActionGuard } from '../auth/workflow-action.guard.js';

describe('RepairRequestsController', () => {
  let controller: RepairRequestsController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepairRequestsController],
      providers: [{ provide: RepairRequestsService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WorkflowActionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<RepairRequestsController>(RepairRequestsController);
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
