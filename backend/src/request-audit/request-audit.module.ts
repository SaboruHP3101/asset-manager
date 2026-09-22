import { Global, Module } from '@nestjs/common';
import { RequestAuditService } from './request-audit.service.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { RequestAuditController } from './request-audit.controller.js';
import { AuthModule } from '../auth/auth.module.js';

/**
 * Audit là hạ tầng dùng chung cho cả ba luồng nên được đăng ký global, tránh mỗi
 * module tự triển khai một cách ghi log khác nhau và làm sai cấu trúc dữ liệu.
 */
@Global()
@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [RequestAuditController],
  providers: [RequestAuditService],
  exports: [RequestAuditService],
})
export class RequestAuditModule {}
