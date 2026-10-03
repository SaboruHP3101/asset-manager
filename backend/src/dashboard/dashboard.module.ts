import { Module } from '@nestjs/common';
import { AssetAllocationsModule } from '../asset-allocations/asset-allocations.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module.js';
import { PurchaseReceiptsModule } from '../purchase-receipts/purchase-receipts.module.js';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [
    DrizzleModule,
    AuthModule,
    PurchaseRequestsModule,
    PurchaseOrdersModule,
    PurchaseReceiptsModule,
    AssetAllocationsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
