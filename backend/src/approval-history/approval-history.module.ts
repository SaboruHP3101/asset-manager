import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { ApprovalHistoryController } from './approval-history.controller.js';
import { ApprovalHistoryService } from './approval-history.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [ApprovalHistoryController],
  providers: [ApprovalHistoryService],
})
export class ApprovalHistoryModule {}
