import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { PurchaseContractsController } from './purchase-contracts.controller.js';
import { PurchaseContractsService } from './purchase-contracts.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [PurchaseContractsController],
  providers: [PurchaseContractsService],
})
export class PurchaseContractsModule {}
