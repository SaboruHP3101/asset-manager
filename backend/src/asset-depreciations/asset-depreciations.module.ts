import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { AssetDepreciationsController } from './asset-depreciations.controller.js';
import { AssetDepreciationsService } from './asset-depreciations.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [AssetDepreciationsController],
  providers: [AssetDepreciationsService],
})
export class AssetDepreciationsModule {}
