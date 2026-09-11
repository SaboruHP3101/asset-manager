import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { RepairRequestsController } from './repair-requests.controller.js';
import { RepairRequestsService } from './repair-requests.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [RepairRequestsController],
  providers: [RepairRequestsService],
})
export class RepairRequestsModule {}
