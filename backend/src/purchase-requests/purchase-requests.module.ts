import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { PurchaseRequestsController } from './purchase-requests.controller.js';
import { PurchaseRequestsService } from './purchase-requests.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService],
})
export class PurchaseRequestsModule {}
