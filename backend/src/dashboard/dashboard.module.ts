import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
