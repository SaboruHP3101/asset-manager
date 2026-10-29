import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module.js';
import { RepairRequestsModule } from '../repair-requests/repair-requests.module.js';
import { ChatController } from './chat.controller.js';
import { ChatQueryService } from './chat-query.service.js';
import { ChatService } from './chat.service.js';
import { GeminiService } from './gemini.service.js';

@Module({
  imports: [
    AuthModule,
    DrizzleModule,
    PurchaseRequestsModule,
    RepairRequestsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatQueryService, GeminiService],
})
export class ChatModule {}
