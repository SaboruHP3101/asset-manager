import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { AssetAllocationsController } from './asset-allocations.controller.js';
import { AssetAllocationsService } from './asset-allocations.service.js';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [AssetAllocationsController],
  providers: [AssetAllocationsService],
  exports: [AssetAllocationsService],
})
export class AssetAllocationsModule {}
