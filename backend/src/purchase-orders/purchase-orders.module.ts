import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
