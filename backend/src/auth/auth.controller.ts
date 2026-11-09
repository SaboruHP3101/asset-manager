import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Headers,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthDto } from './dto/auth.dto.js';
import { SetupPasswordDto } from './dto/setup-password.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginDto: AuthDto) {
    return this.authService.login(loginDto);
  }

  @Post('setup-password')
  async setupPassword(
    @Headers('authorization') authHeader: string,
    @Body() dto: SetupPasswordDto,
  ) {
    // Lấy token dạng "Bearer <token>" từ header
    const token = authHeader?.split(' ')[1];

    return this.authService.setupFirstTimePassword(token, dto);
  }

  @Post('check-exists')
  findOneByEmail(@Body() { email }: { email: string }) {
    return this.authService.checkEmail(email);
  }

  // Trả về hồ sơ của tài khoản đang đăng nhập
  @Get('me')
  getProfile(@Headers('authorization') authHeader: string) {
    return this.authService.getProfile(authHeader);
  }
}
