import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { AssetDepreciationsController } from './asset-depreciations.controller.js';
import { AssetDepreciationsService } from './asset-depreciations.service.js';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [AssetDepreciationsController],
  providers: [AssetDepreciationsService],
})
export class AssetDepreciationsModule {}
