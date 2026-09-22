import { Global, Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  imports: [DrizzleModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
