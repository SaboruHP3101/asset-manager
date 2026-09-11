import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { SupplierContactsController } from './supplier-contacts.controller.js';
import { SupplierContactsService } from './supplier-contacts.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [SupplierContactsController],
  providers: [SupplierContactsService],
})
export class SupplierContactsModule {}
