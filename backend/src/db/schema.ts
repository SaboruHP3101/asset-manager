import {
  AnyPgColumn,
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

const createdBy = () =>
  uuid('created_by').references((): AnyPgColumn => employees.id);

const updatedBy = () =>
  uuid('updated_by').references((): AnyPgColumn => employees.id);

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeCode: varchar('employee_code', { length: 100 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phoneNumber: varchar('phone_number', { length: 50 }),
  departmentId: uuid('department_id')
    .notNull()
    .references(() => departments.id),
  roleId: uuid('role_id')
    .notNull()
    .references(() => roles.id),
  isDepartmentHead: boolean('is_department_head').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const assetCategories = pgTable('asset_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  parentCategoryId: uuid('parent_category_id').references(
    (): AnyPgColumn => assetCategories.id,
  ),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierCode: varchar('supplier_code', { length: 100 }).notNull().unique(),
  legalName: varchar('legal_name', { length: 255 }).notNull(),
  tradeName: varchar('trade_name', { length: 255 }),
  taxCode: varchar('tax_code', { length: 100 }).notNull().unique(),
  website: varchar('website', { length: 2048 }),
  status: varchar('status', { length: 100 }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const supplierContacts = pgTable('supplier_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  position: varchar('position', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 50 }),
  isPrimaryContact: boolean('is_primary_contact').notNull().default(false),
});

export const supplierAddresses = pgTable('supplier_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  addressType: varchar('address_type', { length: 100 }).notNull(),
  address: varchar('address', { length: 1000 }).notNull(),
  provinceCity: varchar('province_city', { length: 255 }),
  country: varchar('country', { length: 255 }).notNull(),
});

export const purchaseRequests = pgTable('purchase_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id')
    .notNull()
    .references(() => employees.id),
  departmentId: uuid('department_id')
    .notNull()
    .references(() => departments.id),
  assetCategoryId: uuid('asset_category_id')
    .notNull()
    .references(() => assetCategories.id),
  quantity: integer('quantity').notNull(),
  requestDate: date('request_date', { mode: 'string' }).notNull(),
  status: varchar('status', { length: 100 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const purchaseContracts = pgTable('purchase_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractNumber: varchar('contract_number', { length: 100 })
    .notNull()
    .unique(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  signedDate: date('signed_date', { mode: 'string' }).notNull(),
  effectiveDate: date('effective_date', { mode: 'string' }).notNull(),
  expirationDate: date('expiration_date', { mode: 'string' }).notNull(),
  contractValue: numeric('contract_value').notNull(),
  status: varchar('status', { length: 100 }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderCode: varchar('purchase_order_code', { length: 100 })
    .notNull()
    .unique(),
  contractId: uuid('contract_id').references(() => purchaseContracts.id),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  createdByEmployeeId: uuid('created_by_employee_id')
    .notNull()
    .references(() => employees.id),
  orderDate: date('order_date', { mode: 'string' }).notNull(),
  expectedDeliveryDate: date('expected_delivery_date', {
    mode: 'string',
  }).notNull(),
  totalValue: numeric('total_value').notNull(),
  status: varchar('status', { length: 100 }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const purchaseOrderRequests = pgTable('purchase_order_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id),
  purchaseRequestId: uuid('purchase_request_id')
    .notNull()
    .references(() => purchaseRequests.id),
  createdAt: createdAt(),
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id),
  assetCategoryId: uuid('asset_category_id')
    .notNull()
    .references(() => assetCategories.id),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price').notNull(),
  totalAmount: numeric('total_amount').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetCode: varchar('asset_code', { length: 100 }).notNull().unique(),
  qrCode: varchar('qr_code', { length: 255 }).notNull().unique(),
  assetCategoryId: uuid('asset_category_id')
    .notNull()
    .references(() => assetCategories.id),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  currentUserId: uuid('current_user_id').references(() => employees.id),
  currentManagingDepartmentId: uuid(
    'current_managing_department_id',
  ).references(() => departments.id),
  purchaseOrderItemId: uuid('purchase_order_item_id').references(
    () => purchaseOrderItems.id,
  ),
  status: varchar('status', { length: 100 }).notNull(),
  initialValue: numeric('initial_value').notNull(),
  purchaseDate: date('purchase_date', { mode: 'string' }).notNull(),
  inServiceDate: date('in_service_date', { mode: 'string' }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const assetHandoverHistory = pgTable('asset_handover_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id),
  handoverType: varchar('handover_type', { length: 100 }).notNull(),
  handoverFromEmployeeId: uuid('handover_from_employee_id').references(
    () => employees.id,
  ),
  receivedByEmployeeId: uuid('received_by_employee_id').references(
    () => employees.id,
  ),
  handoverFromDepartmentId: uuid('handover_from_department_id').references(
    () => departments.id,
  ),
  receivedByDepartmentId: uuid('received_by_department_id').references(
    () => departments.id,
  ),
  handoverDate: date('handover_date', { mode: 'string' }).notNull(),
  status: varchar('status', { length: 100 }).notNull(),
  note: text('note'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const repairRequests = pgTable('repair_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => employees.id),
  reportDate: date('report_date', { mode: 'string' }).notNull(),
  issueDescription: text('issue_description').notNull(),
  status: varchar('status', { length: 100 }).notNull(),
  repairCost: numeric('repair_cost'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const assetInventories = pgTable('asset_inventories', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id),
  inspectedByEmployeeId: uuid('inspected_by_employee_id')
    .notNull()
    .references(() => employees.id),
  inspectionDate: date('inspection_date', { mode: 'string' }).notNull(),
  completionDate: date('completion_date', { mode: 'string' }),
  actualStatus: varchar('actual_status', { length: 100 }).notNull(),
  note: text('note'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const assetLiquidations = pgTable('asset_liquidations', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposedByEmployeeId: uuid('proposed_by_employee_id')
    .notNull()
    .references(() => employees.id),
  proposedDate: date('proposed_date', { mode: 'string' }).notNull(),
  approvedDate: date('approved_date', { mode: 'string' }),
  liquidationDate: date('liquidation_date', { mode: 'string' }),
  status: varchar('status', { length: 100 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const assetLiquidationItems = pgTable('asset_liquidation_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  liquidationId: uuid('liquidation_id')
    .notNull()
    .references(() => assetLiquidations.id),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id),
  liquidationValue: numeric('liquidation_value').notNull(),
  note: text('note'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const assetDepreciations = pgTable('asset_depreciations', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id),
  fromDate: date('from_date', { mode: 'string' }).notNull(),
  toDate: date('to_date', { mode: 'string' }).notNull(),
  openingValue: numeric('opening_value').notNull(),
  depreciationAmount: numeric('depreciation_amount').notNull(),
  remainingValue: numeric('remaining_value').notNull(),
  depreciationMethod: varchar('depreciation_method', { length: 100 }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: createdBy(),
  updatedBy: updatedBy(),
});

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }).notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  uploadedByEmployeeId: uuid('uploaded_by_employee_id')
    .notNull()
    .references(() => employees.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const approvalHistory = pgTable('approval_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  approverId: uuid('approver_id')
    .notNull()
    .references(() => employees.id),
  approvalStep: integer('approval_step').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  previousStatus: varchar('previous_status', { length: 100 }).notNull(),
  newStatus: varchar('new_status', { length: 100 }).notNull(),
  note: text('note'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const changeHistory = pgTable('change_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  performedByEmployeeId: uuid('performed_by_employee_id')
    .notNull()
    .references(() => employees.id),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 1000 }),
  createdAt: createdAt(),
});
