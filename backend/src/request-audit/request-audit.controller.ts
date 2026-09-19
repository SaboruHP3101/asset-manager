import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestAuditService } from './request-audit.service.js';
import type { RequestType } from './request-audit.service.js';

const requestTypes = {
  purchase: 'purchase',
  transfer: 'transfer',
  repair: 'repair',
} as const;

@ApiTags('request-audit')
@Controller('request-audit')
/** Resource đọc timeline xử lý theo loại yêu cầu và mã yêu cầu. */
export class RequestAuditController {
  constructor(private readonly audit: RequestAuditService) {}

  /** Một endpoint chung phục vụ timeline của cả purchase, transfer và repair. */
  @Get(':requestType/:requestId')
  findTrail(
    @Param('requestType', new ParseEnumPipe(requestTypes))
    requestType: RequestType,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.audit.findTrail(requestType, requestId);
  }
}
