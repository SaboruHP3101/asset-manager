import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { PurchaseReceiptsController } from './purchase-receipts.controller.js';
import { PurchaseReceiptsService } from './purchase-receipts.service.js';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [PurchaseReceiptsController],
  providers: [PurchaseReceiptsService],
})
export class PurchaseReceiptsModule {}
