import { loadEnvFile } from 'node:process';
import * as bcrypt from 'bcrypt';
import { eq, inArray } from 'drizzle-orm';
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

async function seedWarehouses(departmentIds: Map<string, string>) {
  await db
    .insert(schema.warehouses)
    .values({
      code: 'IT_WAREHOUSE',
      name: 'Kho IT',
      managingDepartmentId: departmentIds.get('IT')!,
      location: 'Kho IT',
    })
    .onConflictDoUpdate({
      target: schema.warehouses.code,
      set: {
        name: 'Kho IT',
        managingDepartmentId: departmentIds.get('IT')!,
        location: 'Kho IT',
        isActive: true,
        updatedAt: new Date(),
      },
    });
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
    {
      supplierCode: 'NCC-CELLPHONE-S',
      legalName: 'Công ty CPTM và DVKT Diệu Phúc',
      tradeName: 'CellphoneS',
      taxCode: '0318001004',
      website: 'https://example.com/cellphone-s',
      status: 'Đang hợp tác',
    },
    {
      supplierCode: 'NCC-PHONG-VU',
      legalName: 'Công ty Cổ phần Thương mại Dịch vụ Phong Vũ',
      tradeName: 'Phong Vũ',
      taxCode: '0318001005',
      website: 'https://example.com/phong-vu',
      status: 'Đang hợp tác',
    },
    {
      supplierCode: 'NCC-FPT-SHOP',
      legalName: 'Công ty Cổ phần Bán lẻ Kỹ thuật số FPT',
      tradeName: 'FPT Shop',
      taxCode: '0318001006',
      website: 'https://example.com/fpt-shop',
      status: 'Đang hợp tác',
    },
    {
      supplierCode: 'NCC-AN-PHAT',
      legalName: 'Công ty Cổ phần Thương mại Máy tính An Phát',
      tradeName: 'An Phát Computer',
      taxCode: '0318001007',
      website: 'https://example.com/an-phat',
      status: 'Đang hợp tác',
    },
    {
      supplierCode: 'NCC-HOA-PHAT',
      legalName: 'Công ty Cổ phần Nội thất Hòa Phát',
      tradeName: 'Nội thất Hòa Phát',
      taxCode: '0318001008',
      website: 'https://example.com/hoa-phat',
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
  const departmentEmailSlugs = {
    IT: 'it',
    ACCOUNTING: 'ke-toan',
    WAREHOUSE: 'kho-van',
    PROCUREMENT: 'thu-mua',
    EXECUTIVE: 'ban-dieu-hanh',
  } as const;
  const employees = [
    ['NV001', 'Nguyễn Minh Anh', '0901000001', 'IT', 'IT', true],
    ['NV002', 'Trần Thu Hà', '0901000002', 'ACCOUNTING', 'ACCOUNTING', true],
    ['NV003', 'Lê Quốc Bảo', '0901000003', 'WAREHOUSE', 'EMPLOYEE', true],
    [
      'NV004',
      'Phạm Ngọc Lan',
      '0901000004',
      'PROCUREMENT',
      'PROCUREMENT',
      false,
    ],
    ['NV005', 'Võ Hoàng Nam', '0901000005', 'IT', 'EMPLOYEE', false],
    ['NV006', 'Đặng Thanh Sơn', '0901000006', 'EXECUTIVE', 'EXECUTIVE', false],
    ['NV007', 'Bùi Hải Yến', '0901000007', 'PROCUREMENT', 'PROCUREMENT', true],
    ['NV008', 'Đỗ Gia Huy', '0901000008', 'WAREHOUSE', 'EMPLOYEE', false],
    ['NV009', 'Phan Minh Hải', '0901000009', 'ACCOUNTING', 'EMPLOYEE', false],
  ] as const;

  for (const employee of employees) {
    const [employeeCode, fullName, phoneNumber, department, role, isHead] =
      employee;
    const email = `${isHead ? 'truong.' : ''}${departmentEmailSlugs[department]}@email.com`;

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

type AssetSeed = readonly [
  assetCode: string,
  categoryCode: string,
  assetName: string,
  employeeCode: string | null,
  supplierCode: string,
  status: string,
];

// Thêm từ sáu đến bảy tài sản cho mỗi nhân viên và mười tài sản trong kho IT
async function seedAssets(
  employees: Map<string, typeof schema.employees.$inferSelect>,
  categories: Map<string, typeof schema.assetCategories.$inferSelect>,
  supplierIds: Map<string, string>,
) {
  const [itWarehouse] = await db
    .select()
    .from(schema.warehouses)
    .where(eq(schema.warehouses.code, 'IT_WAREHOUSE'));

  if (!itWarehouse) {
    throw new Error('Không tìm thấy Kho IT để tạo tài sản mẫu.');
  }

  const baseAssets = [
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
      'in_use',
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
      'in_use',
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
  ] as const satisfies readonly AssetSeed[];

  const assetTemplates = [
    ['ELECTRONICS-LAPTOP', 'Dell Latitude 7440', 'NCC-MINH-PHAT'],
    ['ELECTRONICS-LAPTOP', 'Apple MacBook Pro 14in', 'NCC-CELLPHONE-S'],
    ['ELECTRONICS-MONITOR', 'Dell UltraSharp 27', 'NCC-PHONG-VU'],
    ['ELECTRONICS-PRINTER', 'Canon imageCLASS', 'NCC-FPT-SHOP'],
    ['ELECTRONICS-NETWORK', 'Bộ định tuyến Cisco ISR', 'NCC-VIET-TIN'],
    ['ELECTRONICS-BARCODE', 'Zebra DS2208', 'NCC-AN-PHAT'],
    ['FURNITURE-CHAIR', 'Ghế công thái học', 'NCC-HOA-PHAT'],
    ['WAREHOUSE-EQUIPMENT-CART', 'Xe đẩy hàng inox', 'NCC-AN-KHANG'],
  ] as const;
  const employeeTargets = [
    ['NV001', 7],
    ['NV002', 7],
    ['NV003', 6],
    ['NV004', 6],
    ['NV005', 6],
    ['NV006', 6],
    ['NV007', 6],
    ['NV008', 6],
    ['NV009', 6],
  ] as const;
  const generatedAssets: AssetSeed[] = [];
  let nextAssetNumber = baseAssets.length + 1;

  for (const [
    employeeIndex,
    [employeeCode, targetCount],
  ] of employeeTargets.entries()) {
    const currentCount = baseAssets.filter(
      (asset) => asset[3] === employeeCode,
    ).length;

    for (let index = currentCount; index < targetCount; index += 1) {
      const template =
        assetTemplates[(employeeIndex + index) % assetTemplates.length];

      generatedAssets.push([
        `TS${String(nextAssetNumber).padStart(3, '0')}`,
        template[0],
        template[1],
        employeeCode,
        template[2],
        'in_use',
      ]);
      nextAssetNumber += 1;
    }
  }

  for (let index = 0; index < 10; index += 1) {
    const template = assetTemplates[index % assetTemplates.length];

    generatedAssets.push([
      `TS${String(nextAssetNumber).padStart(3, '0')}`,
      template[0],
      template[1],
      null,
      template[2],
      'available',
    ]);
    nextAssetNumber += 1;
  }

  const assets: AssetSeed[] = [...baseAssets, ...generatedAssets];

  for (const [
    assetCode,
    categoryCode,
    assetName,
    employeeCode,
    supplierCode,
    status,
  ] of assets) {
    const employee = employeeCode ? employees.get(employeeCode) : undefined;

    if (employeeCode && !employee) {
      throw new Error(
        `Không tìm thấy nhân viên ${employeeCode} để tạo tài sản.`,
      );
    }

    const category = categories.get(categoryCode);
    const supplierId = supplierIds.get(supplierCode);

    if (!category || !supplierId) {
      throw new Error(
        `Thiếu danh mục ${categoryCode} hoặc nhà cung cấp ${supplierCode}.`,
      );
    }

    const assetValues = {
      qrCode: `QR-${assetCode}`,
      assetCategoryId: category.id,
      supplierId,
      currentUserId: employee?.id ?? null,
      currentManagingDepartmentId:
        employee?.departmentId ?? itWarehouse.managingDepartmentId,
      currentWarehouseId: employee ? null : itWarehouse.id,
      name: assetName,
      currentLocation: employee ? null : itWarehouse.location,
      status,
      initialValue: '25000000',
      purchaseDate: '2026-01-15',
      inServiceDate: '2026-02-01',
    };

    await db
      .insert(schema.assets)
      .values({
        assetCode,
        ...assetValues,
      })
      .onConflictDoUpdate({
        target: schema.assets.assetCode,
        set: {
          ...assetValues,
          updatedAt: new Date(),
        },
      });
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

// Chạy các bước theo thứ tự để bảo đảm khóa ngoại đã tồn tại
async function main() {
  if (process.argv.includes('--categories-only')) {
    await seedCategories();
    console.log('Đã tạo cây danh mục mới thành công.');

    return;
  }

  const departments = await seedDepartments();

  await seedWarehouses(departments);
  const roles = await seedRoles();
  const categories = await seedCategories();
  const suppliers = await seedSuppliers();
  const employees = await seedEmployees(departments, roles);

  await seedAssets(employees, categories, suppliers);

  console.log('Đã thêm dữ liệu lõi mẫu còn thiếu thành công.');
}

main()
  .catch((error) => {
    console.error('Không thể thêm dữ liệu mẫu:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
