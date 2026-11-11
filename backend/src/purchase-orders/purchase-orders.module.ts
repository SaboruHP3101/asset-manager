import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { ItPurchaseOrdersController } from './it-purchase-orders.controller.js';
import { ItPurchaseOrdersService } from './it-purchase-orders.service.js';
import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [PurchaseOrdersController, ItPurchaseOrdersController],
  providers: [PurchaseOrdersService, ItPurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
