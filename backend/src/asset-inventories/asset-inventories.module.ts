import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { AssetInventoriesController } from './asset-inventories.controller.js';
import { AssetInventoriesService } from './asset-inventories.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [AssetInventoriesController],
  providers: [AssetInventoriesService],
})
export class AssetInventoriesModule {}
