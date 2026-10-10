import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { AssetRecallRequestsController } from './asset-recall-requests.controller.js';
import { AssetRecallRequestsService } from './asset-recall-requests.service.js';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [AssetRecallRequestsController],
  providers: [AssetRecallRequestsService],
  exports: [AssetRecallRequestsService],
})
export class AssetRecallRequestsModule {}
