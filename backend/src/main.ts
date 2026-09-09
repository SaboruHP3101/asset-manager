import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 8080;

  // Kích hoạt ValidationPipe toàn cục để DTO hoạt động chính xác
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Asset Management API')
    .setDescription('Tài liệu API quản lý tài sản')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document);

  await app.listen(port);
}
await bootstrap();
