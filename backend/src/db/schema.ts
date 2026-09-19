import {
  AnyPgColumn,
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const purchaseStatusEnum = pgEnum('purchase_status', [
  'draft',
  'submitted',
  'dept_approved',
  'finance_approved',
  'exec_approved',
  'ordered',
  'received',
  'asset_created',
  'allocated',
  'cancelled',
]);

export const transferStatusEnum = pgEnum('transfer_status', [
  'requested',
  'dept_approved',
  'verified',
  'handoff_pending',
  'completed',
  'cancelled',
]);

export const repairStatusEnum = pgEnum('repair_status', [
  'reported',
  'assessed',
  'approval_pending',
  'in_progress',
  'completed',
  'confirmed',
  'rejected',
  'closed',
  'cancelled',
]);

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
  password: varchar('password', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
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

export const purchaseRequests = pgTable(
  'purchase_requests',
  {
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
    status: purchaseStatusEnum('status').notNull().default('draft'),
    reason: text('reason').notNull(),
    deptHeadId: uuid('dept_head_id').references(() => employees.id),
    deptHeadApprovedAt: timestamp('dept_head_approved_at', {
      withTimezone: true,
    }),
    financeReviewedBy: uuid('finance_reviewed_by').references(
      () => employees.id,
    ),
    financeReviewedAt: timestamp('finance_reviewed_at', {
      withTimezone: true,
    }),
    execApprovedBy: uuid('exec_approved_by').references(() => employees.id),
    execApprovedAt: timestamp('exec_approved_at', { withTimezone: true }),
    procurementBy: uuid('procurement_by').references(() => employees.id),
    procuredAt: timestamp('procured_at', { withTimezone: true }),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    invoiceNumber: varchar('invoice_number', { length: 255 }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    receivedBy: uuid('received_by').references(() => employees.id),
    receivedAssets: uuid('received_assets').array(),
    allocatedTo: uuid('allocated_to').references(() => employees.id),
    allocatedAt: timestamp('allocated_at', { withTimezone: true }),
    allocationConfirmedBy: uuid('allocation_confirmed_by').references(
      () => employees.id,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_purchase_status').on(table.status),
    index('idx_purchase_department').on(table.departmentId),
    index('idx_purchase_requester').on(table.requesterId),
  ],
);

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
  name: varchar('name', { length: 255 }),
  currentLocation: varchar('current_location', { length: 500 }),
  currentValue: numeric('current_value'),
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

export const transferRequests = pgTable(
  'transfer_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: transferStatusEnum('status').notNull().default('requested'),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),
    initiatedBy: uuid('initiated_by')
      .notNull()
      .references(() => employees.id),
    fromDepartmentId: uuid('from_department_id')
      .notNull()
      .references(() => departments.id),
    toDepartmentId: uuid('to_department_id')
      .notNull()
      .references(() => departments.id),
    toUserId: uuid('to_user_id').references(() => employees.id),
    newLocation: varchar('new_location', { length: 500 }),
    reason: text('reason').notNull(),
    deptHeadApprovedBy: uuid('dept_head_approved_by').references(
      () => employees.id,
    ),
    deptHeadApprovedAt: timestamp('dept_head_approved_at', {
      withTimezone: true,
    }),
    assetTeamVerifiedBy: uuid('asset_team_verified_by').references(
      () => employees.id,
    ),
    assetTeamVerifiedAt: timestamp('asset_team_verified_at', {
      withTimezone: true,
    }),
    senderConfirmedBy: uuid('sender_confirmed_by').references(
      () => employees.id,
    ),
    senderConfirmedAt: timestamp('sender_confirmed_at', { withTimezone: true }),
    receiverConfirmedBy: uuid('receiver_confirmed_by').references(
      () => employees.id,
    ),
    receiverConfirmedAt: timestamp('receiver_confirmed_at', {
      withTimezone: true,
    }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('idx_transfer_status').on(table.status),
    index('idx_transfer_asset').on(table.assetId),
    index('idx_transfer_from_department').on(table.fromDepartmentId),
    index('idx_transfer_to_department').on(table.toDepartmentId),
  ],
);

export const repairRequests = pgTable(
  'repair_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => employees.id),
    departmentId: uuid('department_id').references(() => departments.id),
    reportDate: date('report_date', { mode: 'string' }).notNull(),
    issueDescription: text('issue_description').notNull(),
    status: repairStatusEnum('status').notNull().default('reported'),
    assessedBy: uuid('assessed_by').references(() => employees.id),
    assessedAt: timestamp('assessed_at', { withTimezone: true }),
    assessmentNotes: text('assessment_notes'),
    needsApproval: boolean('needs_approval').notNull().default(false),
    estimatedRepairCost: numeric('estimated_repair_cost'),
    approvedBy: uuid('approved_by').references(() => employees.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    assignedTo: uuid('assigned_to').references(() => employees.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    resultNotes: text('result_notes'),
    repairCost: numeric('repair_cost'),
    confirmedBy: uuid('confirmed_by').references(() => employees.id),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmationStatus: varchar('confirmation_status', { length: 50 }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_repair_status').on(table.status),
    index('idx_repair_asset').on(table.assetId),
    index('idx_repair_department').on(table.departmentId),
    index('idx_repair_reporter').on(table.reporterId),
  ],
);

export const requestApprovals = pgTable(
  'request_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestType: varchar('request_type', { length: 50 }).notNull(),
    requestId: uuid('request_id').notNull(),
    actionType: varchar('action_type', { length: 50 }).notNull(),
    approverRole: varchar('approver_role', { length: 50 }).notNull(),
    approvedBy: uuid('approved_by')
      .notNull()
      .references(() => employees.id),
    status: varchar('status', { length: 50 }).notNull(),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_request_approval_type').on(table.requestType),
    index('idx_request_approval_request').on(table.requestId),
    index('idx_request_approval_created_at').on(table.createdAt),
  ],
);

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
