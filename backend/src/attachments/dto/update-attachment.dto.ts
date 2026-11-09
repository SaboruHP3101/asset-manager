import { PartialType } from '@nestjs/mapped-types';
import { CreateAttachmentDto } from './create-attachment.dto.js';

export class UpdateAttachmentDto extends PartialType(CreateAttachmentDto) {}
