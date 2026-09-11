import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { PurchaseOrderItemsController } from './purchase-order-items.controller.js';
import { PurchaseOrderItemsService } from './purchase-order-items.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [PurchaseOrderItemsController],
  providers: [PurchaseOrderItemsService],
})
export class PurchaseOrderItemsModule {}
