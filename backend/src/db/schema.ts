import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * it - IT duyệt chuyên môn, kiểm tra và quản lý thiết bị điện tử.
 * procurement - Thu mua kiểm tra và quản lý các hạng mục không phải thiết bị điện tử.
 */
export const assetManagementOwnerEnum = pgEnum('asset_management_owner', [
  'it',
  'procurement',
]);

/**
 * individual_asset - Theo dõi riêng từng đơn vị, tạo asset code và QR sau khi tiếp nhận đạt.
 * consumable - Chỉ theo dõi số lượng tiếp nhận, không tạo asset hoặc QR cho từng đơn vị.
 */
export const assetTrackingModeEnum = pgEnum('asset_tracking_mode', [
  'individual_asset',
  'consumable',
]);

/**
 * draft - Bản nháp đang được người đề nghị chỉnh sửa.
 * pending_department_head - Đã gửi và đang chờ Trưởng phòng của đơn vị đề nghị duyệt nhu cầu.
 * pending_procurement_enrichment - Trưởng phòng đã duyệt, đang chờ Thu mua bổ sung báo giá và nhà cung cấp.
 * pending_procurement_head - Đã đủ thông tin thương mại, đang chờ Trưởng Thu mua duyệt.
 * pending_it_head - Có hạng mục điện tử đã qua Thu mua và đang chờ Trưởng IT duyệt.
 * revision_required - Bị từ chối và đã trả về phòng ban để chỉnh sửa revision mới.
 * approved - Tất cả cấp duyệt bắt buộc đã hoàn tất, có thể bắt đầu đặt mua.
 * ordering - Đã tạo ít nhất một PO nhưng vẫn còn số lượng chưa đặt hết.
 * fully_ordered - Toàn bộ số lượng đã được đưa vào các PO hợp lệ.
 */
export const purchaseRequestStatusEnum = pgEnum('purchase_request_status', [
  'draft',
  'pending_department_head',
  'pending_procurement_enrichment',
  'pending_procurement_head',
  'pending_it_head',
  'revision_required',
  'approved',
  'ordering',
  'fully_ordered',
]);

/**
 * draft - PO đang được Thu mua soạn và vẫn có thể chỉnh sửa.
 * pending_procurement_head - PO đã gửi, đang chờ Trưởng Thu mua duyệt phát hành.
 * issued - PO đã được duyệt và phát hành cho nhà cung cấp.
 * partially_received - Đã tiếp nhận một phần số lượng đặt mua.
 * fully_received - Đã tiếp nhận đủ toàn bộ số lượng đặt mua.
 * closed_short - PO được đóng khi nhà cung cấp giao thiếu và không giao bù phần còn lại.
 * cancelled - PO đã bị hủy và không còn hiệu lực nhận hàng.
 */
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'draft',
  'pending_procurement_head',
  'issued',
  'partially_received',
  'fully_received',
  'closed_short',
  'cancelled',
]);

/**
 * pending_inspection - Đợt giao đã được ghi nhận nhưng chưa bắt đầu kiểm tra.
 * inspecting - Một phần hoặc toàn bộ hàng trong đợt giao đang được kiểm tra.
 * inspected - Tất cả dòng hàng và đơn vị theo dõi riêng đã có kết quả kiểm tra.
 */
export const purchaseReceiptStatusEnum = pgEnum('purchase_receipt_status', [
  'pending_inspection',
  'inspecting',
  'inspected',
]);

/**
 * pending - Chưa có kết luận kiểm tra.
 * accepted - Hàng đạt yêu cầu và được chấp nhận nhập.
 * rejected - Hàng không đạt yêu cầu và bị từ chối nhận.
 */
export const inspectionResultEnum = pgEnum('inspection_result', [
  'pending',
  'accepted',
  'rejected',
]);

/**
 * pending_confirmations - Đang chờ đủ xác nhận của Trưởng phòng và người nhận.
 * confirmed - Cả Trưởng phòng và người nhận đã xác nhận cấp phát.
 * rejected - Ít nhất một bên đã từ chối lần cấp phát này.
 * superseded - Lần cấp phát đã được thay thế bằng một attempt mới.
 */
export const assetAllocationStatusEnum = pgEnum('asset_allocation_status', [
  'pending_confirmations',
  'confirmed',
  'rejected',
  'superseded',
]);

/**
 * pending - Người có trách nhiệm chưa đưa ra quyết định.
 * confirmed - Người có trách nhiệm đồng ý với thông tin cấp phát.
 * rejected - Người có trách nhiệm từ chối thông tin cấp phát.
 */
export const allocationDecisionEnum = pgEnum('allocation_decision', [
  'pending',
  'confirmed',
  'rejected',
]);

/**
 * requested - Yêu cầu điều chuyển mới được tạo và đang chờ xử lý.
 * dept_approved - Trưởng phòng đã duyệt yêu cầu điều chuyển.
 * verified - Bộ phận quản lý tài sản đã kiểm tra và xác nhận thông tin.
 * handoff_pending - Đang chờ bên giao và bên nhận hoàn tất bàn giao thực tế.
 * completed - Điều chuyển đã hoàn tất và thông tin quản lý tài sản đã được cập nhật.
 * cancelled - Yêu cầu điều chuyển đã bị hủy.
 */
export const transferStatusEnum = pgEnum('transfer_status', [
  'requested',
  'dept_approved',
  'verified',
  'handoff_pending',
  'completed',
  'cancelled',
]);

/**
 * reported - Sự cố mới được báo cáo và chưa đánh giá.
 * assessed - Sự cố đã được đánh giá về phương án và chi phí sửa chữa.
 * approval_pending - Phương án sửa chữa đang chờ người có thẩm quyền duyệt.
 * in_progress - Tài sản đang được sửa chữa.
 * completed - Công việc sửa chữa đã hoàn thành, đang chờ xác nhận kết quả.
 * confirmed - Người có trách nhiệm đã xác nhận kết quả sửa chữa đạt yêu cầu.
 * rejected - Kết quả sửa chữa bị từ chối và cần xử lý tiếp.
 * closed - Hồ sơ sửa chữa đã kết thúc và không còn hành động đang chờ.
 * cancelled - Yêu cầu sửa chữa đã bị hủy.
 */
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

export const assetCategories = pgTable(
  'asset_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 100 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    parentCategoryId: uuid('parent_category_id').references(
      (): AnyPgColumn => assetCategories.id,
    ),
    description: text('description'),
    managementOwner: assetManagementOwnerEnum('management_owner')
      .notNull()
      .default('procurement'),
    trackingMode: assetTrackingModeEnum('tracking_mode')
      .notNull()
      .default('individual_asset'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_asset_category_management_owner').on(table.managementOwner),
    index('idx_asset_category_tracking_mode').on(table.trackingMode),
  ],
);

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
    requestCode: varchar('request_code', { length: 100 }).notNull().unique(),
    status: purchaseRequestStatusEnum('status').notNull().default('draft'),
    currentRevision: integer('current_revision').notNull().default(1),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => employees.id),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_purchase_request_status').on(table.status),
    index('idx_purchase_department').on(table.departmentId),
    index('idx_purchase_requester').on(table.requesterId),
  ],
);

export const purchaseRequestRevisions = pgTable(
  'purchase_request_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseRequestId: uuid('purchase_request_id')
      .notNull()
      .references(() => purchaseRequests.id),
    revisionNumber: integer('revision_number').notNull(),
    neededByDate: date('needed_by_date', { mode: 'string' }).notNull(),
    purpose: text('purpose').notNull(),
    note: text('note'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedBy: uuid('submitted_by').references(() => employees.id),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    returnedBy: uuid('returned_by').references(() => employees.id),
    returnReason: text('return_reason'),
    createdAt: createdAt(),
    createdBy: createdBy(),
  },
  (table) => [
    uniqueIndex('uq_purchase_request_revision').on(
      table.purchaseRequestId,
      table.revisionNumber,
    ),
    index('idx_purchase_request_revision_request').on(table.purchaseRequestId),
    check(
      'chk_purchase_request_revision_positive',
      sql`${table.revisionNumber} > 0`,
    ),
  ],
);

export const purchaseRequestItems = pgTable(
  'purchase_request_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestRevisionId: uuid('request_revision_id')
      .notNull()
      .references(() => purchaseRequestRevisions.id),
    assetCategoryId: uuid('asset_category_id')
      .notNull()
      .references(() => assetCategories.id),
    itemName: varchar('item_name', { length: 255 }).notNull(),
    specifications: text('specifications').notNull(),
    purpose: text('purpose'),
    quantity: integer('quantity').notNull(),
    unit: varchar('unit', { length: 50 }).notNull(),
    managementOwnerSnapshot: assetManagementOwnerEnum(
      'management_owner_snapshot',
    ).notNull(),
    trackingModeSnapshot: assetTrackingModeEnum(
      'tracking_mode_snapshot',
    ).notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    uniqueIndex('uq_purchase_request_item_sort_order').on(
      table.requestRevisionId,
      table.sortOrder,
    ),
    index('idx_purchase_request_item_revision').on(table.requestRevisionId),
    check('chk_purchase_request_item_quantity', sql`${table.quantity} > 0`),
    check('chk_purchase_request_item_sort_order', sql`${table.sortOrder} > 0`),
  ],
);

export const purchaseRequestQuotes = pgTable(
  'purchase_request_quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestItemId: uuid('request_item_id')
      .notNull()
      .references(() => purchaseRequestItems.id),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    attachmentId: uuid('attachment_id')
      .notNull()
      .references((): AnyPgColumn => attachments.id),
    unitPriceExclVat: numeric('unit_price_excl_vat', {
      precision: 18,
      scale: 0,
    }).notNull(),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull(),
    isSelected: boolean('is_selected').notNull().default(false),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    uniqueIndex('uq_purchase_request_quote_supplier').on(
      table.requestItemId,
      table.supplierId,
    ),
    uniqueIndex('uq_purchase_request_quote_selected')
      .on(table.requestItemId)
      .where(sql`${table.isSelected} = true`),
    index('idx_purchase_request_quote_item').on(table.requestItemId),
    check(
      'chk_purchase_request_quote_price',
      sql`${table.unitPriceExclVat} >= 0`,
    ),
    check(
      'chk_purchase_request_quote_vat',
      sql`${table.vatRate} >= 0 AND ${table.vatRate} <= 100`,
    ),
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

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderCode: varchar('purchase_order_code', { length: 100 })
      .notNull()
      .unique(),
    purchaseRequestId: uuid('purchase_request_id')
      .notNull()
      .references(() => purchaseRequests.id),
    requestRevisionId: uuid('request_revision_id')
      .notNull()
      .references(() => purchaseRequestRevisions.id),
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
    status: purchaseOrderStatusEnum('status').notNull().default('draft'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedBy: uuid('submitted_by').references(() => employees.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => employees.id),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: uuid('cancelled_by').references(() => employees.id),
    cancellationReason: text('cancellation_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_purchase_order_request').on(table.purchaseRequestId),
    index('idx_purchase_order_revision').on(table.requestRevisionId),
    index('idx_purchase_order_status').on(table.status),
  ],
);

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    purchaseRequestItemId: uuid('purchase_request_item_id')
      .notNull()
      .references(() => purchaseRequestItems.id),
    selectedQuoteId: uuid('selected_quote_id')
      .notNull()
      .references(() => purchaseRequestQuotes.id),
    itemNameSnapshot: varchar('item_name_snapshot', { length: 255 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceExclVat: numeric('unit_price_excl_vat', {
      precision: 18,
      scale: 0,
    }).notNull(),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull(),
    subtotalExclVat: numeric('subtotal_excl_vat', {
      precision: 18,
      scale: 0,
    }).notNull(),
    vatAmount: numeric('vat_amount', { precision: 18, scale: 0 }).notNull(),
    totalInclVat: numeric('total_incl_vat', {
      precision: 18,
      scale: 0,
    }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_purchase_order_item_order').on(table.purchaseOrderId),
    index('idx_purchase_order_item_request_item').on(
      table.purchaseRequestItemId,
    ),
    check('chk_purchase_order_item_quantity', sql`${table.quantity} > 0`),
  ],
);

export const purchaseReceipts = pgTable(
  'purchase_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    receiptCode: varchar('receipt_code', { length: 100 }).notNull().unique(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    status: purchaseReceiptStatusEnum('status')
      .notNull()
      .default('pending_inspection'),
    deliveryDate: date('delivery_date', { mode: 'string' }).notNull(),
    deliveryNoteNumber: varchar('delivery_note_number', {
      length: 100,
    }).notNull(),
    deliveryNoteAttachmentId: uuid('delivery_note_attachment_id')
      .notNull()
      .references((): AnyPgColumn => attachments.id),
    invoiceAttachmentId: uuid('invoice_attachment_id').references(
      (): AnyPgColumn => attachments.id,
    ),
    warrantyAttachmentId: uuid('warranty_attachment_id').references(
      (): AnyPgColumn => attachments.id,
    ),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => employees.id),
    inspectedAt: timestamp('inspected_at', { withTimezone: true }),
    inspectedBy: uuid('inspected_by').references(() => employees.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    index('idx_purchase_receipt_order').on(table.purchaseOrderId),
    index('idx_purchase_receipt_status').on(table.status),
  ],
);

export const purchaseReceiptItems = pgTable(
  'purchase_receipt_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseReceiptId: uuid('purchase_receipt_id')
      .notNull()
      .references(() => purchaseReceipts.id),
    purchaseOrderItemId: uuid('purchase_order_item_id')
      .notNull()
      .references(() => purchaseOrderItems.id),
    deliveredQuantity: integer('delivered_quantity').notNull(),
    acceptedQuantity: integer('accepted_quantity').notNull().default(0),
    rejectedQuantity: integer('rejected_quantity').notNull().default(0),
    managementOwnerSnapshot: assetManagementOwnerEnum(
      'management_owner_snapshot',
    ).notNull(),
    trackingModeSnapshot: assetTrackingModeEnum(
      'tracking_mode_snapshot',
    ).notNull(),
    inspectionResult: inspectionResultEnum('inspection_result')
      .notNull()
      .default('pending'),
    inspectedBy: uuid('inspected_by').references(() => employees.id),
    inspectedAt: timestamp('inspected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    uniqueIndex('uq_purchase_receipt_item_order_item').on(
      table.purchaseReceiptId,
      table.purchaseOrderItemId,
    ),
    index('idx_purchase_receipt_item_receipt').on(table.purchaseReceiptId),
    check(
      'chk_purchase_receipt_item_delivered_quantity',
      sql`${table.deliveredQuantity} > 0`,
    ),
    check(
      'chk_purchase_receipt_item_accepted_quantity',
      sql`${table.acceptedQuantity} >= 0`,
    ),
    check(
      'chk_purchase_receipt_item_rejected_quantity',
      sql`${table.rejectedQuantity} >= 0`,
    ),
    check(
      'chk_purchase_receipt_item_inspected_quantity',
      sql`${table.acceptedQuantity} + ${table.rejectedQuantity} <= ${table.deliveredQuantity}`,
    ),
  ],
);

export const purchaseReceiptUnits = pgTable(
  'purchase_receipt_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseReceiptItemId: uuid('purchase_receipt_item_id')
      .notNull()
      .references(() => purchaseReceiptItems.id),
    sequenceNumber: integer('sequence_number').notNull(),
    serialNumber: varchar('serial_number', { length: 255 }),
    inspectionResult: inspectionResultEnum('inspection_result')
      .notNull()
      .default('pending'),
    inspectedBy: uuid('inspected_by').references(() => employees.id),
    inspectedAt: timestamp('inspected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    evidenceAttachmentId: uuid('evidence_attachment_id').references(
      (): AnyPgColumn => attachments.id,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    uniqueIndex('uq_purchase_receipt_unit_sequence').on(
      table.purchaseReceiptItemId,
      table.sequenceNumber,
    ),
    index('idx_purchase_receipt_unit_item').on(table.purchaseReceiptItemId),
    check(
      'chk_purchase_receipt_unit_sequence',
      sql`${table.sequenceNumber} > 0`,
    ),
  ],
);

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
  purchaseReceiptUnitId: uuid('purchase_receipt_unit_id')
    .unique()
    .references(() => purchaseReceiptUnits.id),
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

export const assetAllocations = pgTable(
  'asset_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),
    attemptNumber: integer('attempt_number').notNull(),
    initiatedBy: uuid('initiated_by')
      .notNull()
      .references(() => employees.id),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => employees.id),
    location: varchar('location', { length: 500 }).notNull(),
    managementOwnerSnapshot: assetManagementOwnerEnum(
      'management_owner_snapshot',
    ).notNull(),
    status: assetAllocationStatusEnum('status')
      .notNull()
      .default('pending_confirmations'),
    departmentHeadDecision: allocationDecisionEnum('department_head_decision')
      .notNull()
      .default('pending'),
    departmentHeadDecidedBy: uuid('department_head_decided_by').references(
      () => employees.id,
    ),
    departmentHeadDecidedAt: timestamp('department_head_decided_at', {
      withTimezone: true,
    }),
    departmentHeadNote: text('department_head_note'),
    recipientDecision: allocationDecisionEnum('recipient_decision')
      .notNull()
      .default('pending'),
    recipientDecidedAt: timestamp('recipient_decided_at', {
      withTimezone: true,
    }),
    recipientNote: text('recipient_note'),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: createdBy(),
    updatedBy: updatedBy(),
  },
  (table) => [
    uniqueIndex('uq_asset_allocation_attempt').on(
      table.assetId,
      table.attemptNumber,
    ),
    uniqueIndex('uq_asset_allocation_pending')
      .on(table.assetId)
      .where(sql`${table.status} = 'pending_confirmations'`),
    index('idx_asset_allocation_recipient').on(table.recipientId),
    index('idx_asset_allocation_department').on(table.departmentId),
    check('chk_asset_allocation_attempt', sql`${table.attemptNumber} > 0`),
  ],
);

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
    workflowRevision: integer('workflow_revision'),
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

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => employees.id),
    notificationType: varchar('notification_type', { length: 100 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    entityType: varchar('entity_type', { length: 100 }),
    entityId: uuid('entity_id'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_notification_recipient').on(table.recipientId),
    index('idx_notification_recipient_read').on(
      table.recipientId,
      table.readAt,
    ),
    index('idx_notification_entity').on(table.entityType, table.entityId),
  ],
);

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
