import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { PurchaseOrderRequestsController } from './purchase-order-requests.controller.js';
import { PurchaseOrderRequestsService } from './purchase-order-requests.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [PurchaseOrderRequestsController],
  providers: [PurchaseOrderRequestsService],
})
export class PurchaseOrderRequestsModule {}
