import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthDto } from './dto/auth.dto.js';
import { SetupPasswordDto } from './dto/setup-password.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Log in to get Access Token' })
  login(@Body() loginDto: AuthDto) {
    return this.authService.login(loginDto);
  }

  @Post('setup-password')
  @ApiOperation({
    summary: 'Set a password for new employees for the first time.',
  })
  async setupPassword(
    @Headers('authorization') authHeader: string,
    @Body() dto: SetupPasswordDto,
  ) {
    // Lấy token dạng "Bearer <token>" từ header
    const token = authHeader?.split(' ')[1];

    return this.authService.setupFirstTimePassword(token, dto);
  }
}
