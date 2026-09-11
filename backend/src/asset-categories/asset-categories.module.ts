import { Module } from '@nestjs/common';
import { AssetCategoriesService } from './asset-categories.service.js';
import { AssetCategoriesController } from './asset-categories.controller.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';

@Module({
  controllers: [AssetCategoriesController],
  providers: [AssetCategoriesService],
  imports: [DrizzleModule],
})
export class AssetCategoriesModule {}
