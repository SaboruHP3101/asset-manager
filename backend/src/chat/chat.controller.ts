import {
  Body,
  Controller,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { ChatMessageDto } from './chat.dto.js';
import { ChatService } from './chat.service.js';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('messages')
  ask(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: ChatMessageDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    return this.chat.ask(dto, actor);
  }
}
