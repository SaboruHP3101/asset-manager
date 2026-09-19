import { loadEnvFile } from 'node:process';
import * as bcrypt from 'bcrypt';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

loadEnvFile();

// Tạo địa chỉ kết nối từ các biến riêng để hỗ trợ .env có biến lồng nhau
const databaseUrl = `postgres://${encodeURIComponent(process.env.POSTGRES_USER ?? '')}:${encodeURIComponent(process.env.POSTGRES_PASSWORD ?? '')}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? ''}`;
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool, { schema });

// Thêm phòng ban còn thiếu và trả về dữ liệu để tạo nhân viên
async function seedDepartments() {
  const names = [
    'Phòng Công nghệ thông tin',
    'Phòng Kế toán',
    'Phòng Kho vận',
    'Phòng Thu mua',
    'Ban Điều hành',
  ];

  await db
    .insert(schema.departments)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing({ target: schema.departments.name });

  const rows = await db.select().from(schema.departments);
  return new Map(rows.map((row) => [row.name, row.id]));
}

// Tạo đúng các vai trò được khai báo trong workflow-actions.config.ts
async function seedRoles() {
  const names = ['Nhân viên', 'Kế toán', 'Điều hành', 'Thu mua', 'IT'];
  await db
    .insert(schema.roles)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing({ target: schema.roles.name });

  const rows = await db.select().from(schema.roles);
  const roleIds = new Map(rows.map((row) => [row.name, row.id]));

  /**
   * Chuẩn hóa các role quản lý cũ về Nhân viên và giữ trách nhiệm trưởng phòng
   * bằng isDepartmentHead. Cách này xử lý cả dữ liệu seed cũ dùng tên Quản lý.
   */
  const legacyHeadRoleIds = ['Quản lý', 'Trưởng bộ phận']
    .map((name) => roleIds.get(name))
    .filter((id): id is string => Boolean(id));

  for (const legacyHeadRoleId of legacyHeadRoleIds) {
    await db
      .update(schema.employees)
      .set({
        roleId: roleIds.get('Nhân viên')!,
        isDepartmentHead: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.employees.roleId, legacyHeadRoleId));
    await db.delete(schema.roles).where(eq(schema.roles.id, legacyHeadRoleId));
  }

  const legacyItId = roleIds.get('Nhân viên IT');
  if (legacyItId) {
    await db
      .update(schema.employees)
      .set({ roleId: roleIds.get('IT')!, updatedAt: new Date() })
      .where(eq(schema.employees.roleId, legacyItId));
    await db.delete(schema.roles).where(eq(schema.roles.id, legacyItId));
  }

  const normalizedRows = await db.select().from(schema.roles);
  return new Map(normalizedRows.map((row) => [row.name, row.id]));
}

// Thêm cây danh mục và dùng danh mục cuối làm tên tài sản
async function seedCategories() {
  const categories = [
    ['MT', 'Máy tính', null, 'Nhóm máy tính phục vụ công việc'],
    ['MT-APPLE', 'Apple', 'MT', 'Máy tính thương hiệu Apple'],
    [
      'MT-MBP14',
      'MacBook Pro 14',
      'MT-APPLE',
      'Máy tính xách tay cho công việc chuyên môn',
    ],
    ['MT-DELL', 'Dell', 'MT', 'Máy tính thương hiệu Dell'],
    [
      'MT-LAT7440',
      'Dell Latitude 7440',
      'MT-DELL',
      'Máy tính xách tay dành cho doanh nghiệp',
    ],
    ['MT-LENOVO', 'Lenovo', 'MT', 'Máy tính thương hiệu Lenovo'],
    [
      'MT-X1',
      'Lenovo ThinkPad X1',
      'MT-LENOVO',
      'Máy tính xách tay gọn nhẹ cho văn phòng',
    ],
    ['VP', 'Thiết bị văn phòng', null, 'Thiết bị sử dụng trong văn phòng'],
    ['VP-MAYIN', 'Máy in', 'VP', 'Nhóm thiết bị in ấn'],
    [
      'VP-CANON',
      'Máy in Canon imageCLASS',
      'VP-MAYIN',
      'Máy in laser dùng chung trong phòng ban',
    ],
    ['VP-MANHINH', 'Màn hình', 'VP', 'Nhóm màn hình máy tính'],
    [
      'VP-DELL27',
      'Màn hình Dell UltraSharp 27',
      'VP-MANHINH',
      'Màn hình làm việc độ phân giải cao',
    ],
    ['KHO', 'Thiết bị kho', null, 'Thiết bị hỗ trợ quản lý kho'],
    ['KHO-QUET', 'Máy quét mã vạch', 'KHO', 'Nhóm máy quét mã vạch trong kho'],
    [
      'KHO-ZEBRA',
      'Máy quét Zebra DS2208',
      'KHO-QUET',
      'Máy quét mã vạch cầm tay',
    ],
    ['MANG', 'Thiết bị mạng', null, 'Thiết bị phục vụ hệ thống mạng nội bộ'],
    ['MANG-CISCO', 'Cisco', 'MANG', 'Thiết bị mạng thương hiệu Cisco'],
    [
      'MANG-ISR',
      'Bộ định tuyến Cisco ISR',
      'MANG-CISCO',
      'Bộ định tuyến cho mạng văn phòng',
    ],
  ] as const;

  const categoryIds = new Map<string, string>();
  for (const [code, name, parentCode, description] of categories) {
    await db
      .insert(schema.assetCategories)
      .values({
        code,
        name,
        description,
        parentCategoryId: parentCode ? categoryIds.get(parentCode) : null,
      })
      .onConflictDoNothing({ target: schema.assetCategories.code });

    const [row] = await db
      .select()
      .from(schema.assetCategories)
      .where(eq(schema.assetCategories.code, code));
    categoryIds.set(code, row.id);
  }

  return categoryIds;
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

// Thêm sáu tài khoản đại diện cho các role và phòng ban trong môi trường phát triển
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
      'Phòng Công nghệ thông tin',
      'IT',
      true,
    ],
    [
      'NV002',
      'Trần Thu Hà',
      'thu.ha@example.com',
      '0901000002',
      'Phòng Kế toán',
      'Kế toán',
      true,
    ],
    [
      'NV003',
      'Lê Quốc Bảo',
      'quoc.bao@example.com',
      '0901000003',
      'Phòng Kho vận',
      'Nhân viên',
      true,
    ],
    [
      'NV004',
      'Phạm Ngọc Lan',
      'ngoc.lan@example.com',
      '0901000004',
      'Phòng Thu mua',
      'Thu mua',
      false,
    ],
    [
      'NV005',
      'Võ Hoàng Nam',
      'hoang.nam@example.com',
      '0901000005',
      'Phòng Công nghệ thông tin',
      'Nhân viên',
      false,
    ],
    [
      'NV006',
      'Đặng Thanh Sơn',
      'thanh.son@example.com',
      '0901000006',
      'Ban Điều hành',
      'Điều hành',
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
  categoryIds: Map<string, string>,
  supplierIds: Map<string, string>,
) {
  const assets = [
    ['TS001', 'MT-MBP14', 'NV001', 'NCC-MINH-PHAT', 'in_use'],
    ['TS002', 'MT-LAT7440', 'NV001', 'NCC-MINH-PHAT', 'in_use'],
    ['TS003', 'VP-DELL27', 'NV001', 'NCC-AN-KHANG', 'in_use'],
    ['TS004', 'MANG-ISR', 'NV001', 'NCC-VIET-TIN', 'repairing'],
    ['TS005', 'MT-LAT7440', 'NV002', 'NCC-MINH-PHAT', 'in_use'],
    ['TS006', 'VP-DELL27', 'NV002', 'NCC-AN-KHANG', 'in_use'],
    ['TS007', 'VP-CANON', 'NV002', 'NCC-AN-KHANG', 'available'],
    ['TS008', 'MT-X1', 'NV002', 'NCC-MINH-PHAT', 'in_use'],
    ['TS009', 'KHO-ZEBRA', 'NV003', 'NCC-VIET-TIN', 'in_use'],
    ['TS010', 'KHO-ZEBRA', 'NV003', 'NCC-VIET-TIN', 'repairing'],
    ['TS011', 'MT-X1', 'NV003', 'NCC-MINH-PHAT', 'in_use'],
    ['TS012', 'MT-MBP14', 'NV004', 'NCC-MINH-PHAT', 'in_use'],
    ['TS013', 'VP-DELL27', 'NV004', 'NCC-AN-KHANG', 'in_use'],
    ['TS014', 'VP-CANON', 'NV004', 'NCC-AN-KHANG', 'available'],
    ['TS015', 'MT-X1', 'NV005', 'NCC-MINH-PHAT', 'in_use'],
    ['TS016', 'VP-DELL27', 'NV005', 'NCC-AN-KHANG', 'in_use'],
    ['TS017', 'MANG-ISR', 'NV005', 'NCC-VIET-TIN', 'repairing'],
  ] as const;

  for (const [
    assetCode,
    categoryCode,
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
        assetCategoryId: categoryIds.get(categoryCode)!,
        supplierId: supplierIds.get(supplierCode)!,
        currentUserId: employee.id,
        currentManagingDepartmentId: employee.departmentId,
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
  const departments = await seedDepartments();
  const roles = await seedRoles();
  const categories = await seedCategories();
  const suppliers = await seedSuppliers();
  const employees = await seedEmployees(departments, roles);
  const assets = await seedAssets(employees, categories, suppliers);
  await seedAttachments(assets, employees.get('NV001')!.id);
  console.log('Đã thêm dữ liệu mẫu còn thiếu thành công.');
}

main()
  .catch((error) => {
    console.error('Không thể thêm dữ liệu mẫu:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
