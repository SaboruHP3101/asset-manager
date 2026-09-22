import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service.js';
import { DrizzleModule } from './drizzle/drizzle.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { RolesModule } from './roles/roles.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AssetCategoriesModule } from './asset-categories/asset-categories.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { SupplierContactsModule } from './supplier-contacts/supplier-contacts.module.js';
import { SupplierAddressesModule } from './supplier-addresses/supplier-addresses.module.js';
import { PurchaseContractsModule } from './purchase-contracts/purchase-contracts.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { AssetHandoverHistoryModule } from './asset-handover-history/asset-handover-history.module.js';
import { RepairRequestsModule } from './repair-requests/repair-requests.module.js';
import { AssetInventoriesModule } from './asset-inventories/asset-inventories.module.js';
import { AssetLiquidationsModule } from './asset-liquidations/asset-liquidations.module.js';
import { AssetLiquidationItemsModule } from './asset-liquidation-items/asset-liquidation-items.module.js';
import { AssetDepreciationsModule } from './asset-depreciations/asset-depreciations.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { ApprovalHistoryModule } from './approval-history/approval-history.module.js';
import { ChangeHistoryModule } from './change-history/change-history.module.js';
import { RequestAuditModule } from './request-audit/request-audit.module.js';
import { TransferRequestsModule } from './transfer-requests/transfer-requests.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true, // Thêm dòng này để NestJS tự dịch các biến ${} trong file .env
    }),
    DrizzleModule,
    RequestAuditModule,
    EmployeesModule,
    DepartmentsModule,
    RolesModule,
    AuthModule,
    AssetCategoriesModule,
    SuppliersModule,
    SupplierContactsModule,
    SupplierAddressesModule,
    PurchaseContractsModule,
    AssetsModule,
    AssetHandoverHistoryModule,
    RepairRequestsModule,
    AssetInventoriesModule,
    AssetLiquidationsModule,
    AssetLiquidationItemsModule,
    AssetDepreciationsModule,
    AttachmentsModule,
    ApprovalHistoryModule,
    ChangeHistoryModule,
    TransferRequestsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
