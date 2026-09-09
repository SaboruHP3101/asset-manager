import { PartialType } from '@nestjs/mapped-types';
import { CreateDepartmentDto } from './create-department.dto.js';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
  @IsUUID()
  @IsOptional()
  updatedBy?: string;
}
