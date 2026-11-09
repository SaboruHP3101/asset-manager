import { PartialType } from '@nestjs/mapped-types';
import { CreateApprovalHistoryDto } from './create-approval-history.dto.js';

export class UpdateApprovalHistoryDto extends PartialType(
  CreateApprovalHistoryDto,
) {}
