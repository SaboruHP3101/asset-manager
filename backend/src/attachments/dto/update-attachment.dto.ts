import { PartialType } from '@nestjs/swagger';
import { CreateAttachmentDto } from './create-attachment.dto.js';

export class UpdateAttachmentDto extends PartialType(CreateAttachmentDto) {}
