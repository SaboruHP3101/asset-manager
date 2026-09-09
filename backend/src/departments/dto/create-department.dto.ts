import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;
}
