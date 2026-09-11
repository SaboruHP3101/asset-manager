import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { AssetLiquidationItemsController } from './asset-liquidation-items.controller.js';
import { AssetLiquidationItemsService } from './asset-liquidation-items.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [AssetLiquidationItemsController],
  providers: [AssetLiquidationItemsService],
})
export class AssetLiquidationItemsModule {}
