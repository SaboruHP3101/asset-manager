import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';

const confirmationFlag = '--confirm';

type CleanupClient = {
  query: (query: string) => Promise<{ rowCount: number | null }>;
};

export const preservedCoreTables = [
  'assets',
  'asset_categories',
  'departments',
  'suppliers',
  'employees',
  'roles',
  'warehouses',
] as const;

// Thứ tự xóa đi từ bảng phụ thuộc đến bảng cha để giữ nguyên khóa ngoại
// của bảy bảng lõi mà không cần dùng CASCADE.
export const nonCoreTableCleanupOrder = [
  'notifications',
  'approval_history',
  'change_history',
  'request_approvals',
  'asset_liquidation_items',
  'asset_liquidations',
  'asset_depreciations',
  'asset_inventories',
  'repair_requests',
  'transfer_requests',
  'asset_recall_requests',
  'asset_handover_history',
  'asset_allocations',
  'purchase_receipt_units',
  'purchase_receipt_items',
  'purchase_receipts',
  'purchase_order_items',
  'purchase_orders',
  'purchase_contracts',
  'purchase_request_quotes',
  'purchase_request_items',
  'purchase_request_revisions',
  'purchase_requests',
  'attachments',
  'supplier_contacts',
  'supplier_addresses',
] as const;

export function validateCleanupRequest(
  nodeEnv: string | undefined,
  args: string[],
): void {
  if (nodeEnv?.toLowerCase() === 'production') {
    throw new Error(
      'Lệnh xóa dữ liệu ngoài bảng lõi bị chặn trong production.',
    );
  }

  if (!args.includes(confirmationFlag)) {
    throw new Error(
      'Thiếu xác nhận. Chạy lại: npm run db:clear-non-core-data -- --confirm',
    );
  }
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string {
  if (env.DATABASE_URL && !env.DATABASE_URL.includes('${')) {
    return env.DATABASE_URL;
  }

  const user = env.POSTGRES_USER;
  const password = env.POSTGRES_PASSWORD;
  const database = env.POSTGRES_DB;

  if (!user || !password || !database) {
    throw new Error(
      'Thiếu DATABASE_URL hoặc POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB.',
    );
  }

  const host = env.POSTGRES_HOST ?? 'localhost';
  const port = env.POSTGRES_PORT ?? '5432';

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

export async function clearNonCoreData(
  client: CleanupClient,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  // Asset là dữ liệu lõi, nhưng hai liên kết này trỏ đến dữ liệu purchase
  // sắp bị xóa nên phải gỡ liên kết trước.
  const unlinkedAssets = await client.query(`
    UPDATE assets
    SET purchase_order_item_id = NULL,
        purchase_receipt_unit_id = NULL,
        updated_at = NOW()
    WHERE purchase_order_item_id IS NOT NULL
       OR purchase_receipt_unit_id IS NOT NULL
  `);

  counts.set('assets_purchase_links_cleared', unlinkedAssets.rowCount ?? 0);

  for (const table of nonCoreTableCleanupOrder) {
    const result = await client.query(`DELETE FROM ${table}`);

    counts.set(table, result.rowCount ?? 0);
  }

  return counts;
}

export async function runNonCoreDataCleanup(
  env: NodeJS.ProcessEnv,
  args: string[],
): Promise<Map<string, number>> {
  validateCleanupRequest(env.NODE_ENV, args);

  const pool = new Pool({ connectionString: resolveDatabaseUrl(env) });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const counts = await clearNonCoreData(client);

    await client.query('COMMIT');

    return counts;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  dotenv.config();

  const counts = await runNonCoreDataCleanup(
    process.env,
    process.argv.slice(2),
  );

  console.log('Đã xóa dữ liệu ngoài các bảng lõi:');

  for (const [table, count] of counts) {
    console.log(`- ${table}: ${count}`);
  }

  console.log(`Đã giữ nguyên: ${preservedCoreTables.join(', ')}.`);
  console.log('Các tệp vật lý trong uploads không bị xóa.');
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`Không thể xóa dữ liệu ngoài bảng lõi: ${message}`);
    process.exitCode = 1;
  });
}
