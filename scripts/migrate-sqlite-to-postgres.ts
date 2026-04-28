/**
 * One-shot data migration: copies every row from the committed SQLite DB
 * (`data/plumberos.db` by default) into the Postgres DB at DATABASE_URL.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrate-sqlite-to-postgres.ts
 *
 * Expectations:
 *   - Postgres schema has already been applied (`npx drizzle-kit migrate`)
 *     and the RLS migration at `drizzle/0001_rls.sql` has been run.
 *   - The SQLite file is closed (no app writing to it).
 *
 * Run order per table respects FK dependencies. Each INSERT runs with
 * `SET LOCAL app.role = 'super_admin'` so RLS policies do not block the
 * migration.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';
import path from 'node:path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';

type SqliteRow = Record<string, unknown>;

const SQLITE_FILE = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.resolve(process.cwd(), 'data', 'plumberos.db');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

/**
 * Table copy order: parents before children. Column lists are the columns
 * that exist on both SQLite and Postgres (auto-computed at runtime to support
 * older dev databases that are missing some columns).
 */
const TABLES_IN_ORDER: string[] = [
  'companies',
  'branches',
  'company_phone_numbers',
  'company_payment_settings',
  'invoice_number_sequences',
  'estimate_number_sequences',
  'feature_flags',
  'portal_users',
  'user_memberships',
  'role_permissions',
  'audit_logs',
  'api_keys',
  'integration_connections',
  'plumbers',
  'customers',
  'buckets',
  'leads',
  'jobs',
  'call_logs',
  'invoices',
  'invoice_line_items',
  'estimate_settings',
  'estimates',
  'estimate_line_items',
  'estimate_activity',
  'estimate_delivery',
  'estimate_catalog_services',
  'receptionist_mock_scenarios',
  'receptionist_settings',
  'receptionist_calls',
  'receptionist_transcript_segments',
  'receptionist_events',
  'receptionist_tool_invocations',
  'receptionist_bookings',
  'receptionist_staff_tasks',
  'payments',
  'payment_events',
  'disputes',
  'attachments',
  'notifications',
  'service_contracts',
  'service_contract_schedules',
];

async function main() {
  const sqlite = new Database(SQLITE_FILE, { readonly: true });
  const pool = new Pool({ connectionString: DATABASE_URL });

  const client = await pool.connect();
  let totalRows = 0;
  let tablesCopied = 0;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL app.role = 'super_admin'");
    await client.query("SET CONSTRAINTS ALL DEFERRED");

    for (const table of TABLES_IN_ORDER) {
      if (!sqliteHasTable(sqlite, table) || !(await pgHasTable(client, table))) {
        console.log(`[skip] ${table} — missing on one side`);
        continue;
      }

      const sqliteCols = sqliteColumns(sqlite, table);
      const pgCols = await pgColumns(client, table);
      const shared = sqliteCols.filter((c) => pgCols.has(c));
      if (shared.length === 0) {
        console.log(`[skip] ${table} — no shared columns`);
        continue;
      }

      const rows = sqlite.prepare(`SELECT ${shared.map((c) => `"${c}"`).join(', ')} FROM ${table}`).all() as SqliteRow[];
      if (rows.length === 0) {
        console.log(`[empty] ${table}`);
        continue;
      }

      const colList = shared.map((c) => `"${c}"`).join(', ');
      const placeholders = shared.map((_, i) => `$${i + 1}`).join(', ');
      const stmt = `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      let batch = 0;
      for (const row of rows) {
        const values = shared.map((c) => coerceToPg(c, row[c]));
        try {
          await client.query(stmt, values);
          batch += 1;
        } catch (err) {
          console.error(`[error] ${table} row:`, row, err);
          throw err;
        }
      }
      totalRows += batch;
      tablesCopied += 1;
      console.log(`[done] ${table} — ${batch}/${rows.length} rows`);
    }

    await client.query('COMMIT');
    console.log(`\nMigration finished: ${totalRows} rows across ${tablesCopied} tables.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed — rolled back.', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

function sqliteHasTable(sqlite: Database.Database, table: string): boolean {
  const row = sqlite
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`)
    .get(table);
  return Boolean(row);
}

function sqliteColumns(sqlite: Database.Database, table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

async function pgHasTable(client: any, table: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return r.rowCount > 0;
}

async function pgColumns(client: any, table: string): Promise<Set<string>> {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return new Set(r.rows.map((row: { column_name: string }) => row.column_name));
}

/**
 * SQLite stores booleans as 0/1 and timestamps as ISO text. Postgres is
 * fussier. Map zero/one booleans for columns we know are boolean; leave the
 * rest as-is (pg driver handles text/integer/null fine).
 */
const BOOL_COLUMNS = new Set([
  'is_active',
  'is_primary',
  'active',
  'is_default',
  'disclosure_enabled',
  'recording_enabled',
  'callback_booking_enabled',
  'quote_visit_booking_enabled',
  'online_payments_enabled',
  'estimate_deposits_enabled',
  'invoice_payments_enabled',
  'recording',
  'default_deposit_enabled',
  'customer_signature_required',
  'allow_customer_reject',
  'public_approval_requires_token',
  'is_optional',
  'is_taxable',
  'email_opt_in',
  'sms_opt_in',
]);

function coerceToPg(column: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (BOOL_COLUMNS.has(column)) {
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  }
  return value;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
