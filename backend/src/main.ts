import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import dotenv from 'dotenv';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = process.env.PORT ?? 8080;

  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  });

  // Kích hoạt ValidationPipe toàn cục để DTO hoạt động chính xác
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Cho phép ứng dụng di động đọc ảnh và video đã tải lên
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  await app.listen(port);
}
await bootstrap();
