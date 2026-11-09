import { CreateRoleDto } from './create-role.dto.js';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
