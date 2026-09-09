import {
  IsNotEmpty,
  IsString,
  Length,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @IsUUID()
  @IsOptional()
  createdBy?: string;
}
