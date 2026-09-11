import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { AssetLiquidationsController } from './asset-liquidations.controller.js';
import { AssetLiquidationsService } from './asset-liquidations.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [AssetLiquidationsController],
  providers: [AssetLiquidationsService],
})
export class AssetLiquidationsModule {}
