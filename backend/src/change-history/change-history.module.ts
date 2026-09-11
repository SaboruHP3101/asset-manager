import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { ChangeHistoryController } from './change-history.controller.js';
import { ChangeHistoryService } from './change-history.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [ChangeHistoryController],
  providers: [ChangeHistoryService],
})
export class ChangeHistoryModule {}
