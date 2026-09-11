import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
