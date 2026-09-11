import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
