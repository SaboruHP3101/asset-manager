import { PartialType } from '@nestjs/swagger';
import { CreateApprovalHistoryDto } from './create-approval-history.dto.js';

export class UpdateApprovalHistoryDto extends PartialType(
  CreateApprovalHistoryDto,
) {}
