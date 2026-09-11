import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { AssetHandoverHistoryController } from './asset-handover-history.controller.js';
import { AssetHandoverHistoryService } from './asset-handover-history.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [AssetHandoverHistoryController],
  providers: [AssetHandoverHistoryService],
})
export class AssetHandoverHistoryModule {}
