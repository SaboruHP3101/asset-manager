import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetupPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Passwords must be 6 characters or more.' })
  password: string;
}
