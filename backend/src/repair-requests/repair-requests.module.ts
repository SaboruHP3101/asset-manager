import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { RepairRequestsController } from './repair-requests.controller.js';
import { RepairRequestsService } from './repair-requests.service.js';
import { RepairCostsService } from './repair-costs.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [RepairRequestsController],
  providers: [RepairRequestsService, RepairCostsService],
  exports: [RepairRequestsService],
})
export class RepairRequestsModule {}
