import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { ItPurchaseOrdersService } from './it-purchase-orders.service.js';

@Controller('it-purchase-orders')
@UseGuards(JwtAuthGuard)
export class ItPurchaseOrdersController {
  constructor(private readonly service: ItPurchaseOrdersService) {}

  @Get()
  findAll(
    @CurrentEmployee() actor: AuthenticatedEmployee,
    @Query('owner') owner?: string,
  ) {
    return this.service.findAll(actor, owner);
  }

  @Get(':id')
  findOne(
    @CurrentEmployee() actor: AuthenticatedEmployee,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('owner') owner?: string,
  ) {
    return this.service.findOne(actor, id, owner);
  }
}
