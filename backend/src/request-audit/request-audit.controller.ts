import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestAuditService } from './request-audit.service.js';
import type { RequestType } from './request-audit.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import type { AuthenticatedEmployee } from '../auth/workflow-auth.types.js';
import { PurchaseAuthorizationService } from '../auth/purchase-authorization.service.js';

const requestTypes = {
  purchase: 'purchase',
  transfer: 'transfer',
  repair: 'repair',
} as const;

@ApiTags('request-audit')
@Controller('request-audit')
@UseGuards(JwtAuthGuard)
/** Resource đọc timeline xử lý theo loại yêu cầu và mã yêu cầu. */
export class RequestAuditController {
  constructor(
    private readonly audit: RequestAuditService,
    private readonly purchaseAuthorization: PurchaseAuthorizationService,
  ) {}

  /** Một endpoint chung phục vụ timeline của cả purchase, transfer và repair. */
  @Get(':requestType/:requestId')
  async findTrail(
    @Param('requestType', new ParseEnumPipe(requestTypes))
    requestType: RequestType,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    if (requestType === 'purchase') {
      await this.purchaseAuthorization.assertCanViewRequest(requestId, actor);
    }

    return this.audit.findTrail(requestType, requestId);
  }
}
