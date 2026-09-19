import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseRequestsController } from './purchase-requests.controller.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { WorkflowActionGuard } from '../auth/workflow-action.guard.js';

describe('PurchaseRequestsController', () => {
  let controller: PurchaseRequestsController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseRequestsController],
      providers: [{ provide: PurchaseRequestsService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WorkflowActionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<PurchaseRequestsController>(
      PurchaseRequestsController,
    );
  });
  it('should be defined', () => expect(controller).toBeDefined());
});
