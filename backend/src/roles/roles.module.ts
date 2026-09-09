import { Module } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { RolesController } from './roles.controller.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';

@Module({
  controllers: [RolesController],
  providers: [RolesService],
  imports: [DrizzleModule],
})
export class RolesModule {}
