import { loadEnvFile } from 'node:process';
import * as bcrypt from 'bcrypt';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

loadEnvFile();

type CategorySeed = {
  code: string;
  name: string;
  parentCode: string | null;
  description: string;
  managementOwner: (typeof schema.assetManagementOwnerEnum.enumValues)[number];
  trackingMode: (typeof schema.assetTrackingModeEnum.enumValues)[number];
  isPurchaseOption: boolean;
  allowsCustomType?: boolean;
};

type PurchaseSampleItem = {
  categoryCode: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  supplierCode: string;
  unitPriceExclVat: string;
  vatRate: string;
};

// Tạo địa chỉ kết nối từ các biến riêng để hỗ trợ .env có biến lồng nhau
const databaseUrl = `postgres://${encodeURIComponent(process.env.POSTGRES_USER ?? '')}:${encodeURIComponent(process.env.POSTGRES_PASSWORD ?? '')}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? ''}`;
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool, { schema });

// Thêm phòng ban còn thiếu và trả về dữ liệu để tạo nhân viên
async function seedDepartments() {
  const names = ['IT', 'ACCOUNTING', 'WAREHOUSE', 'PROCUREMENT', 'EXECUTIVE'];

  await db
    .insert(schema.departments)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing({ target: schema.departments.name });

  const rows = await db.select().from(schema.departments);

  return new Map(rows.map((row) => [row.name, row.id]));
}

// Tạo đúng các vai trò được khai báo trong workflow-actions.config.ts
async function seedRoles() {
  const names = ['EMPLOYEE', 'ACCOUNTING', 'EXECUTIVE', 'PROCUREMENT', 'IT'];

  await db
    .insert(schema.roles)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing({ target: schema.roles.name });

  const rows = await db.select().from(schema.roles);

  return new Map(rows.map((row) => [row.name, row.id]));
}

// Hai cấp đầu là danh mục nghiệp vụ được chọn ở đề nghị. Thương hiệu và model
// chỉ phục vụ phân loại chi tiết, không xuất hiện trong form đề nghị mua.
async function seedCategories() {
  const categories = [
    {
      code: 'ELECTRONICS',
      name: 'Thiết bị điện tử & CNTT',
      parentCode: null,
      description: 'Thiết bị điện tử và công nghệ thông tin do IT quản lý',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'ELECTRONICS-LAPTOP',
      name: 'Máy tính xách tay',
      parentCode: 'ELECTRONICS',
      description: 'Máy tính xách tay phục vụ công việc',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'ELECTRONICS-LAPTOP-APPLE',
      name: 'Apple',
      parentCode: 'ELECTRONICS-LAPTOP',
      description: 'Máy tính xách tay thương hiệu Apple',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-LAPTOP-APPLE-MBP14',
      name: 'MacBook Pro 14in',
      parentCode: 'ELECTRONICS-LAPTOP-APPLE',
      description: 'Máy tính xách tay cho công việc chuyên môn',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-LAPTOP-DELL',
      name: 'Dell',
      parentCode: 'ELECTRONICS-LAPTOP',
      description: 'Máy tính xách tay thương hiệu Dell',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-LAPTOP-DELL-LAT7440',
      name: 'Latitude 7440',
      parentCode: 'ELECTRONICS-LAPTOP-DELL',
      description: 'Máy tính xách tay dành cho doanh nghiệp',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-LAPTOP-LENOVO',
      name: 'Lenovo',
      parentCode: 'ELECTRONICS-LAPTOP',
      description: 'Máy tính xách tay thương hiệu Lenovo',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-LAPTOP-LENOVO-X1',
      name: 'ThinkPad X1',
      parentCode: 'ELECTRONICS-LAPTOP-LENOVO',
      description: 'Máy tính xách tay gọn nhẹ cho văn phòng',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-DESKTOP',
      name: 'Máy tính để bàn',
      parentCode: 'ELECTRONICS',
      description: 'Máy tính để bàn và máy trạm',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'ELECTRONICS-MONITOR',
      name: 'Màn hình',
      parentCode: 'ELECTRONICS',
      description: 'Màn hình máy tính và màn hình làm việc',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'ELECTRONICS-MONITOR-DELL',
      name: 'Dell',
      parentCode: 'ELECTRONICS-MONITOR',
      description: 'Màn hình thương hiệu Dell',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-MONITOR-DELL-U27',
      name: 'UltraSharp 27',
      parentCode: 'ELECTRONICS-MONITOR-DELL',
      description: 'Màn hình độ phân giải cao 27 inch',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-PRINTER',
      name: 'Máy in',
      parentCode: 'ELECTRONICS',
      description: 'Máy in dùng chung trong phòng ban',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'ELECTRONICS-PRINTER-CANON',
      name: 'Canon',
      parentCode: 'ELECTRONICS-PRINTER',
      description: 'Máy in thương hiệu Canon',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-PRINTER-CANON-IMAGECLASS',
      name: 'imageCLASS',
      parentCode: 'ELECTRONICS-PRINTER-CANON',
      description: 'Dòng máy in Canon imageCLASS',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-BARCODE',
      name: 'Máy quét mã vạch',
      parentCode: 'ELECTRONICS',
      description: 'Thiết bị quét mã vạch',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'ELECTRONICS-BARCODE-ZEBRA',
      name: 'Zebra',
      parentCode: 'ELECTRONICS-BARCODE',
      description: 'Máy quét mã vạch thương hiệu Zebra',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-BARCODE-ZEBRA-DS2208',
      name: 'DS2208',
      parentCode: 'ELECTRONICS-BARCODE-ZEBRA',
      description: 'Máy quét mã vạch cầm tay Zebra DS2208',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-NETWORK',
      name: 'Thiết bị mạng',
      parentCode: 'ELECTRONICS',
      description: 'Thiết bị phục vụ hệ thống mạng nội bộ',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'ELECTRONICS-NETWORK-CISCO',
      name: 'Cisco',
      parentCode: 'ELECTRONICS-NETWORK',
      description: 'Thiết bị mạng thương hiệu Cisco',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'ELECTRONICS-NETWORK-CISCO-ISR',
      name: 'ISR',
      parentCode: 'ELECTRONICS-NETWORK-CISCO',
      description: 'Bộ định tuyến cho mạng văn phòng',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: false,
    },
    {
      code: 'FURNITURE',
      name: 'Nội thất',
      parentCode: null,
      description: 'Tài sản nội thất do Thu mua quản lý',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'FURNITURE-DESK',
      name: 'Bàn làm việc',
      parentCode: 'FURNITURE',
      description: 'Bàn làm việc và bàn nhân viên',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'FURNITURE-CHAIR',
      name: 'Ghế làm việc',
      parentCode: 'FURNITURE',
      description: 'Ghế làm việc và ghế công thái học',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'FURNITURE-CABINET',
      name: 'Tủ và kệ văn phòng',
      parentCode: 'FURNITURE',
      description: 'Tủ hồ sơ và kệ sử dụng trong văn phòng',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'FURNITURE-MEETING',
      name: 'Nội thất phòng họp',
      parentCode: 'FURNITURE',
      description: 'Bàn, ghế và nội thất phòng họp',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'WAREHOUSE-EQUIPMENT',
      name: 'Thiết bị kho',
      parentCode: null,
      description: 'Công cụ và thiết bị vận hành kho',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'WAREHOUSE-EQUIPMENT-CART',
      name: 'Xe đẩy hàng',
      parentCode: 'WAREHOUSE-EQUIPMENT',
      description: 'Xe đẩy và phương tiện di chuyển hàng trong kho',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'WAREHOUSE-EQUIPMENT-RACK',
      name: 'Kệ kho',
      parentCode: 'WAREHOUSE-EQUIPMENT',
      description: 'Kệ và hệ thống lưu trữ hàng hóa',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'WAREHOUSE-EQUIPMENT-SCALE',
      name: 'Cân điện tử',
      parentCode: 'WAREHOUSE-EQUIPMENT',
      description: 'Cân phục vụ nhập xuất hàng hóa',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'WAREHOUSE-EQUIPMENT-PACKING',
      name: 'Thiết bị đóng gói',
      parentCode: 'WAREHOUSE-EQUIPMENT',
      description: 'Máy móc và dụng cụ đóng gói',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
    },
    {
      code: 'CONSUMABLES',
      name: 'Văn phòng phẩm và vật tư tiêu hao',
      parentCode: null,
      description: 'Vật tư tiêu hao do Thu mua quản lý',
      managementOwner: 'procurement',
      trackingMode: 'consumable',
      isPurchaseOption: true,
    },
    {
      code: 'CONSUMABLES-PAPER',
      name: 'Giấy in',
      parentCode: 'CONSUMABLES',
      description: 'Giấy in và giấy photocopy',
      managementOwner: 'procurement',
      trackingMode: 'consumable',
      isPurchaseOption: true,
    },
    {
      code: 'CONSUMABLES-PAPER-A4-70',
      name: 'Giấy A4 70 gsm',
      parentCode: 'CONSUMABLES-PAPER',
      description: 'Giấy A4 định lượng 70 gsm',
      managementOwner: 'procurement',
      trackingMode: 'consumable',
      isPurchaseOption: false,
    },
    {
      code: 'CONSUMABLES-INK',
      name: 'Mực in',
      parentCode: 'CONSUMABLES',
      description: 'Mực và hộp mực máy in',
      managementOwner: 'procurement',
      trackingMode: 'consumable',
      isPurchaseOption: true,
    },
    {
      code: 'CONSUMABLES-WRITING',
      name: 'Bút và dụng cụ viết',
      parentCode: 'CONSUMABLES',
      description: 'Bút và các dụng cụ viết tiêu hao',
      managementOwner: 'procurement',
      trackingMode: 'consumable',
      isPurchaseOption: true,
    },
    {
      code: 'CONSUMABLES-NOTEBOOK',
      name: 'Sổ và biểu mẫu',
      parentCode: 'CONSUMABLES',
      description: 'Sổ, biểu mẫu và tài liệu in sẵn',
      managementOwner: 'procurement',
      trackingMode: 'consumable',
      isPurchaseOption: true,
    },
    {
      code: 'CONSUMABLES-PACKING',
      name: 'Vật tư đóng gói',
      parentCode: 'CONSUMABLES',
      description: 'Thùng, băng keo và vật tư đóng gói tiêu hao',
      managementOwner: 'procurement',
      trackingMode: 'consumable',
      isPurchaseOption: true,
    },
    {
      code: 'ELECTRONICS-OTHER',
      name: 'Khác',
      parentCode: 'ELECTRONICS',
      description: 'Loại thiết bị điện tử hoặc CNTT chưa có trong danh mục',
      managementOwner: 'it',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
      allowsCustomType: true,
    },
    {
      code: 'FURNITURE-OTHER',
      name: 'Khác',
      parentCode: 'FURNITURE',
      description: 'Loại nội thất chưa có trong danh mục',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
      allowsCustomType: true,
    },
    {
      code: 'WAREHOUSE-EQUIPMENT-OTHER',
      name: 'Khác',
      parentCode: 'WAREHOUSE-EQUIPMENT',
      description: 'Loại thiết bị kho chưa có trong danh mục',
      managementOwner: 'procurement',
      trackingMode: 'individual_asset',
      isPurchaseOption: true,
      allowsCustomType: true,
    },
    {
      code: 'CONSUMABLES-OTHER',
      name: 'Khác',
      parentCode: 'CONSUMABLES',
      description: 'Loại vật tư tiêu hao chưa có trong danh mục',
      managementOwner: 'procurement',
      trackingMode: 'consumable',
      isPurchaseOption: true,
      allowsCustomType: true,
    },
  ] satisfies CategorySeed[];

  const categoryIds = new Map<string, string>();

  for (const category of categories) {
    const {
      code,
      name,
      parentCode,
      description,
      managementOwner,
      trackingMode,
      isPurchaseOption,
      allowsCustomType = false,
    } = category;

    await db
      .insert(schema.assetCategories)
      .values({
        code,
        name,
        description,
        parentCategoryId: parentCode ? categoryIds.get(parentCode) : null,
        managementOwner,
        trackingMode,
        isPurchaseOption,
        allowsCustomType,
      })
      .onConflictDoUpdate({
        target: schema.assetCategories.code,
        set: {
          name,
          description,
          parentCategoryId: parentCode ? categoryIds.get(parentCode) : null,
          managementOwner,
          trackingMode,
          isPurchaseOption,
          allowsCustomType,
        },
      });

    const [row] = await db
      .select()
      .from(schema.assetCategories)
      .where(eq(schema.assetCategories.code, code));

    categoryIds.set(code, row.id);
  }

  const rows = await db.select().from(schema.assetCategories);

  return new Map(rows.map((row) => [row.code, row]));
}

// Thêm các nhà cung cấp
async function seedSuppliers() {
  const suppliers = [
    {
      supplierCode: 'NCC-MINH-PHAT',
      legalName: 'Công ty TNHH Công nghệ Minh Phát',
      tradeName: 'Công nghệ Minh Phát',
      taxCode: '0318001001',
      website: 'https://example.com/minh-phat',
      status: 'Đang hợp tác',
    },
    {
      supplierCode: 'NCC-AN-KHANG',
      legalName: 'Công ty Cổ phần Thiết bị An Khang',
      tradeName: 'Thiết bị An Khang',
      taxCode: '0318001002',
      website: 'https://example.com/an-khang',
      status: 'Đang hợp tác',
    },
    {
      supplierCode: 'NCC-VIET-TIN',
      legalName: 'Công ty TNHH Giải pháp Việt Tín',
      tradeName: 'Giải pháp Việt Tín',
      taxCode: '0318001003',
      website: 'https://example.com/viet-tin',
      status: 'Đang hợp tác',
    },
  ];

  await db
    .insert(schema.suppliers)
    .values(suppliers)
    .onConflictDoNothing({ target: schema.suppliers.supplierCode });

  const rows = await db.select().from(schema.suppliers);

  return new Map(rows.map((row) => [row.supplierCode, row.id]));
}

// Thêm các tài khoản đại diện cho từng vai trò trong workflow và dữ liệu cũ
async function seedEmployees(
  departmentIds: Map<string, string>,
  roleIds: Map<string, string>,
) {
  const password = await bcrypt.hash('Dev@123', 10);
  const employees = [
    [
      'NV001',
      'Nguyễn Minh Anh',
      'minh.anh@example.com',
      '0901000001',
      'IT',
      'IT',
      true,
    ],
    [
      'NV002',
      'Trần Thu Hà',
      'thu.ha@example.com',
      '0901000002',
      'ACCOUNTING',
      'ACCOUNTING',
      true,
    ],
    [
      'NV003',
      'Lê Quốc Bảo',
      'quoc.bao@example.com',
      '0901000003',
      'WAREHOUSE',
      'EMPLOYEE',
      true,
    ],
    [
      'NV004',
      'Phạm Ngọc Lan',
      'ngoc.lan@example.com',
      '0901000004',
      'PROCUREMENT',
      'PROCUREMENT',
      false,
    ],
    [
      'NV005',
      'Võ Hoàng Nam',
      'hoang.nam@example.com',
      '0901000005',
      'IT',
      'EMPLOYEE',
      false,
    ],
    [
      'NV006',
      'Đặng Thanh Sơn',
      'thanh.son@example.com',
      '0901000006',
      'EXECUTIVE',
      'EXECUTIVE',
      false,
    ],
    [
      'NV007',
      'Bùi Hải Yến',
      'hai.yen@example.com',
      '0901000007',
      'PROCUREMENT',
      'PROCUREMENT',
      true,
    ],
    [
      'NV008',
      'Đỗ Gia Huy',
      'gia.huy@example.com',
      '0901000008',
      'WAREHOUSE',
      'EMPLOYEE',
      false,
    ],
  ] as const;

  for (const employee of employees) {
    const [
      employeeCode,
      fullName,
      email,
      phoneNumber,
      department,
      role,
      isHead,
    ] = employee;

    await db
      .insert(schema.employees)
      .values({
        employeeCode,
        fullName,
        email,
        phoneNumber,
        departmentId: departmentIds.get(department)!,
        roleId: roleIds.get(role)!,
        password,
        isDepartmentHead: isHead,
      })
      .onConflictDoUpdate({
        target: schema.employees.employeeCode,
        set: {
          fullName,
          email,
          phoneNumber,
          departmentId: departmentIds.get(department)!,
          roleId: roleIds.get(role)!,
          isDepartmentHead: isHead,
        },
      });
  }

  const rows = await db.select().from(schema.employees);

  return new Map(rows.map((row) => [row.employeeCode, row]));
}

// Thêm từ ba đến bốn tài sản cho mỗi nhân viên
async function seedAssets(
  employees: Map<string, typeof schema.employees.$inferSelect>,
  categories: Map<string, typeof schema.assetCategories.$inferSelect>,
  supplierIds: Map<string, string>,
) {
  const assets = [
    [
      'TS001',
      'ELECTRONICS-LAPTOP',
      'Apple MacBook Pro 14in',
      'NV001',
      'NCC-MINH-PHAT',
      'in_use',
    ],
    [
      'TS002',
      'ELECTRONICS-LAPTOP',
      'Dell Latitude 7440',
      'NV001',
      'NCC-MINH-PHAT',
      'in_use',
    ],
    [
      'TS003',
      'ELECTRONICS-MONITOR',
      'Dell UltraSharp 27',
      'NV001',
      'NCC-AN-KHANG',
      'in_use',
    ],
    [
      'TS004',
      'ELECTRONICS-NETWORK',
      'Bộ định tuyến Cisco ISR',
      'NV001',
      'NCC-VIET-TIN',
      'repairing',
    ],
    [
      'TS005',
      'ELECTRONICS-LAPTOP',
      'Dell Latitude 7440',
      'NV002',
      'NCC-MINH-PHAT',
      'in_use',
    ],
    [
      'TS006',
      'ELECTRONICS-MONITOR',
      'Dell UltraSharp 27',
      'NV002',
      'NCC-AN-KHANG',
      'in_use',
    ],
    [
      'TS007',
      'ELECTRONICS-PRINTER',
      'Canon imageCLASS',
      'NV002',
      'NCC-AN-KHANG',
      'available',
    ],
    [
      'TS008',
      'ELECTRONICS-LAPTOP',
      'Lenovo ThinkPad X1',
      'NV002',
      'NCC-MINH-PHAT',
      'in_use',
    ],
    [
      'TS009',
      'ELECTRONICS-BARCODE',
      'Zebra DS2208',
      'NV003',
      'NCC-VIET-TIN',
      'in_use',
    ],
    [
      'TS010',
      'ELECTRONICS-BARCODE',
      'Zebra DS2208',
      'NV003',
      'NCC-VIET-TIN',
      'repairing',
    ],
    [
      'TS011',
      'ELECTRONICS-LAPTOP',
      'Lenovo ThinkPad X1',
      'NV003',
      'NCC-MINH-PHAT',
      'in_use',
    ],
    [
      'TS012',
      'ELECTRONICS-LAPTOP',
      'Apple MacBook Pro 14in',
      'NV004',
      'NCC-MINH-PHAT',
      'in_use',
    ],
    [
      'TS013',
      'ELECTRONICS-MONITOR',
      'Dell UltraSharp 27',
      'NV004',
      'NCC-AN-KHANG',
      'in_use',
    ],
    [
      'TS014',
      'ELECTRONICS-PRINTER',
      'Canon imageCLASS',
      'NV004',
      'NCC-AN-KHANG',
      'available',
    ],
    [
      'TS015',
      'ELECTRONICS-LAPTOP',
      'Lenovo ThinkPad X1',
      'NV005',
      'NCC-MINH-PHAT',
      'in_use',
    ],
    [
      'TS016',
      'ELECTRONICS-MONITOR',
      'Dell UltraSharp 27',
      'NV005',
      'NCC-AN-KHANG',
      'in_use',
    ],
    [
      'TS017',
      'ELECTRONICS-NETWORK',
      'Bộ định tuyến Cisco ISR',
      'NV005',
      'NCC-VIET-TIN',
      'repairing',
    ],
  ] as const;

  for (const [
    assetCode,
    categoryCode,
    assetName,
    employeeCode,
    supplierCode,
    status,
  ] of assets) {
    const employee = employees.get(employeeCode)!;

    await db
      .insert(schema.assets)
      .values({
        assetCode,
        qrCode: `QR-${assetCode}`,
        assetCategoryId: categories.get(categoryCode)!.id,
        supplierId: supplierIds.get(supplierCode)!,
        currentUserId: employee.id,
        currentManagingDepartmentId: employee.departmentId,
        name: assetName,
        status,
        initialValue: '25000000',
        purchaseDate: '2026-01-15',
        inServiceDate: '2026-02-01',
      })
      .onConflictDoNothing({ target: schema.assets.assetCode });
  }

  return db
    .select()
    .from(schema.assets)
    .where(
      inArray(
        schema.assets.assetCode,
        assets.map((asset) => asset[0]),
      ),
    );
}

async function seedPurchaseRequestSample(
  sample: {
    requestCode: string;
    status: (typeof schema.purchaseRequestStatusEnum.enumValues)[number];
    reason: string;
    items: readonly PurchaseSampleItem[];
  },
  requester: typeof schema.employees.$inferSelect,
  categories: Map<string, typeof schema.assetCategories.$inferSelect>,
  supplierIds: Map<string, string>,
  procurementEmployeeId: string,
) {
  const requestValues = {
    requestCode: sample.requestCode,
    status: sample.status,
    currentRevision: 1,
    requesterId: requester.id,
    departmentId: requester.departmentId,
    createdBy: requester.id,
    updatedBy: requester.id,
  };

  await db
    .insert(schema.purchaseRequests)
    .values(requestValues)
    .onConflictDoUpdate({
      target: schema.purchaseRequests.requestCode,
      set: requestValues,
    });

  const [purchaseRequest] = await db
    .select()
    .from(schema.purchaseRequests)
    .where(eq(schema.purchaseRequests.requestCode, sample.requestCode));

  let [revision] = await db
    .select()
    .from(schema.purchaseRequestRevisions)
    .where(
      and(
        eq(
          schema.purchaseRequestRevisions.purchaseRequestId,
          purchaseRequest.id,
        ),
        eq(schema.purchaseRequestRevisions.revisionNumber, 1),
      ),
    );

  if (revision) {
    [revision] = await db
      .update(schema.purchaseRequestRevisions)
      .set({
        purpose: sample.reason,
        neededByDate: '2026-10-15',
        submittedAt: new Date('2026-09-22T02:00:00.000Z'),
        submittedBy: requester.id,
      })
      .where(eq(schema.purchaseRequestRevisions.id, revision.id))
      .returning();
  } else {
    [revision] = await db
      .insert(schema.purchaseRequestRevisions)
      .values({
        purchaseRequestId: purchaseRequest.id,
        revisionNumber: 1,
        purpose: sample.reason,
        neededByDate: '2026-10-15',
        submittedAt: new Date('2026-09-22T02:00:00.000Z'),
        submittedBy: requester.id,
        createdBy: requester.id,
      })
      .returning();
  }

  for (const [itemIndex, item] of sample.items.entries()) {
    const category = categories.get(item.categoryCode)!;
    const sortOrder = itemIndex + 1;
    const itemValues = {
      assetCategoryId: category.id,
      itemName: item.itemName,
      specifications: item.description,
      quantity: item.quantity,
      unit: item.unit,
      managementOwnerSnapshot: category.managementOwner,
      trackingModeSnapshot: category.trackingMode,
      sortOrder,
      updatedBy: procurementEmployeeId,
    };

    let [requestItem] = await db
      .select()
      .from(schema.purchaseRequestItems)
      .where(
        and(
          eq(schema.purchaseRequestItems.requestRevisionId, revision.id),
          eq(schema.purchaseRequestItems.sortOrder, sortOrder),
        ),
      );

    if (requestItem) {
      [requestItem] = await db
        .update(schema.purchaseRequestItems)
        .set(itemValues)
        .where(eq(schema.purchaseRequestItems.id, requestItem.id))
        .returning();
    } else {
      [requestItem] = await db
        .insert(schema.purchaseRequestItems)
        .values({
          requestRevisionId: revision.id,
          ...itemValues,
          createdBy: procurementEmployeeId,
        })
        .returning();
    }

    const fileName = `Báo giá ${sample.requestCode}-${sortOrder}.pdf`;
    let [quoteAttachment] = await db
      .select()
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.entityId, requestItem.id),
          eq(schema.attachments.fileName, fileName),
        ),
      );

    if (!quoteAttachment) {
      [quoteAttachment] = await db
        .insert(schema.attachments)
        .values({
          entityType: 'purchase_request_item_quote',
          entityId: requestItem.id,
          fileName,
          url: `https://example.com/quotes/${sample.requestCode}-${sortOrder}.pdf`,
          mimeType: 'application/pdf',
          size: 32768,
          uploadedByEmployeeId: procurementEmployeeId,
        })
        .returning();
    }

    const supplierId = supplierIds.get(item.supplierCode)!;
    const [existingQuote] = await db
      .select()
      .from(schema.purchaseRequestQuotes)
      .where(
        and(
          eq(schema.purchaseRequestQuotes.requestItemId, requestItem.id),
          eq(schema.purchaseRequestQuotes.supplierId, supplierId),
        ),
      );
    const quoteValues = {
      attachmentId: quoteAttachment.id,
      unitPriceExclVat: item.unitPriceExclVat,
      vatRate: item.vatRate,
      isSelected: true,
      note: 'Nhà cung cấp thắng cho hạng mục này',
      updatedBy: procurementEmployeeId,
    };

    if (existingQuote) {
      await db
        .update(schema.purchaseRequestQuotes)
        .set(quoteValues)
        .where(eq(schema.purchaseRequestQuotes.id, existingQuote.id));
    } else {
      await db.insert(schema.purchaseRequestQuotes).values({
        requestItemId: requestItem.id,
        supplierId,
        ...quoteValues,
        createdBy: procurementEmployeeId,
      });
    }
  }
}

// Ba hồ sơ mẫu bao phủ nhánh điện tử, phi điện tử và đơn hỗn hợp.
async function seedPurchaseWorkflowSamples(
  employees: Map<string, typeof schema.employees.$inferSelect>,
  categories: Map<string, typeof schema.assetCategories.$inferSelect>,
  supplierIds: Map<string, string>,
) {
  const requester = employees.get('NV008')!;
  const procurementEmployeeId = employees.get('NV004')!.id;
  const samples = [
    {
      requestCode: 'PR-2026-001',
      status: 'pending_it_head',
      reason: 'Trang bị laptop cho nhân viên kho mới',
      items: [
        {
          categoryCode: 'ELECTRONICS-LAPTOP',
          itemName: 'Dell Latitude 7440',
          description: 'RAM 16 GB, SSD 512 GB',
          quantity: 2,
          unit: 'chiếc',
          supplierCode: 'NCC-MINH-PHAT',
          unitPriceExclVat: '24500000',
          vatRate: '10',
        },
      ],
    },
    {
      requestCode: 'PR-2026-002',
      status: 'approved',
      reason: 'Thay ghế làm việc đã xuống cấp',
      items: [
        {
          categoryCode: 'FURNITURE-CHAIR',
          itemName: 'Ghế công thái học',
          description: 'Ghế lưng lưới có tựa đầu',
          quantity: 4,
          unit: 'chiếc',
          supplierCode: 'NCC-AN-KHANG',
          unitPriceExclVat: '4200000',
          vatRate: '10',
        },
      ],
    },
    {
      requestCode: 'PR-2026-003',
      status: 'pending_it_head',
      reason: 'Bổ sung màn hình và giấy in cho kho',
      items: [
        {
          categoryCode: 'ELECTRONICS-MONITOR',
          itemName: 'Màn hình Dell UltraSharp 27',
          description: 'Màn hình phục vụ đối soát hàng hóa',
          quantity: 2,
          unit: 'chiếc',
          supplierCode: 'NCC-AN-KHANG',
          unitPriceExclVat: '8900000',
          vatRate: '10',
        },
        {
          categoryCode: 'CONSUMABLES-PAPER',
          itemName: 'Giấy in A4',
          description: 'Định lượng 70 gsm, 500 tờ/ream',
          quantity: 20,
          unit: 'ream',
          supplierCode: 'NCC-VIET-TIN',
          unitPriceExclVat: '78000',
          vatRate: '8',
        },
      ],
    },
  ] as const;

  for (const sample of samples) {
    await seedPurchaseRequestSample(
      sample,
      requester,
      categories,
      supplierIds,
      procurementEmployeeId,
    );
  }
}

// Thêm một ảnh mẫu cho mỗi tài sản nếu chưa có
async function seedAttachments(
  assets: (typeof schema.assets.$inferSelect)[],
  uploaderId: string,
) {
  for (const asset of assets.filter((item) =>
    item.assetCode.startsWith('TS'),
  )) {
    const fileName = `Ảnh tài sản ${asset.assetCode}.png`;
    const [existing] = await db
      .select({ id: schema.attachments.id })
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.entityId, asset.id),
          eq(schema.attachments.fileName, fileName),
        ),
      );

    if (existing) continue;

    await db.insert(schema.attachments).values({
      entityType: 'asset',
      entityId: asset.id,
      fileName,
      url: `https://placehold.co/600x400/png?text=${asset.assetCode}`,
      mimeType: 'image/png',
      size: 24576,
      uploadedByEmployeeId: uploaderId,
    });
  }
}

// Chạy các bước theo thứ tự để bảo đảm khóa ngoại đã tồn tại
async function main() {
  if (process.argv.includes('--categories-only')) {
    await seedCategories();
    console.log('Đã tạo cây danh mục mới thành công.');

    return;
  }

  const departments = await seedDepartments();
  const roles = await seedRoles();
  const categories = await seedCategories();
  const suppliers = await seedSuppliers();
  const employees = await seedEmployees(departments, roles);
  const assets = await seedAssets(employees, categories, suppliers);

  await seedPurchaseWorkflowSamples(employees, categories, suppliers);
  await seedAttachments(assets, employees.get('NV001')!.id);
  console.log('Đã thêm dữ liệu mẫu còn thiếu thành công.');
}

main()
  .catch((error) => {
    console.error('Không thể thêm dữ liệu mẫu:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
