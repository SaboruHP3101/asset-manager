import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { SupplierAddressesController } from './supplier-addresses.controller.js';
import { SupplierAddressesService } from './supplier-addresses.service.js';

@Module({
  imports: [DrizzleModule],
  controllers: [SupplierAddressesController],
  providers: [SupplierAddressesService],
})
export class SupplierAddressesModule {}
