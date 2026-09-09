import { IsNotEmpty, IsString, MaxLength, IsEmail } from 'class-validator';

export class AuthDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(100)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  password: string;
}
