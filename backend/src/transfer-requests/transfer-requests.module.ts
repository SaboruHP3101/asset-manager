import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { TransferRequestsController } from './transfer-requests.controller.js';
import { TransferRequestsService } from './transfer-requests.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [TransferRequestsController],
  providers: [TransferRequestsService],
})
export class TransferRequestsModule {}
