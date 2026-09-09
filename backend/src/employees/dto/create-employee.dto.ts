import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  employeeCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phoneNumber?: string;

  @IsUUID()
  @IsNotEmpty()
  departmentId: string;

  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @IsBoolean()
  @IsOptional()
  isDepartmentHead?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
