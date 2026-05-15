import { createHash } from 'crypto';
import { getDatabaseMode, sql } from '@/lib/db';

const EXPECTED_TABLES = [
  'companies',
  'company_settings',
  'portal_users',
  'user_memberships',
  'feature_flags',
  'portal_destinations',
  'unassigned_portal_users',
];

const RLS_AUDIT_TABLES = [
  'portal_users',
  'user_memberships',
  'portal_destinations',
  'company_settings',
  'branches',
  'company_phone_numbers',
  'company_payment_settings',
  'invoice_number_sequences',
  'estimate_number_sequences',
  'feature_flags',
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
  'receptionist_settings',
  'receptionist_calls',
  'receptionist_mock_scenarios',
  'payments',
  'disputes',
  'attachments',
  'service_contracts',
  'service_contract_schedules',
];

function stableFingerprint(input: string) {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function connectionIdentity() {
  const value = process.env.DATABASE_URL || process.env.DATABASE_DIRECT_URL || process.env.SQLITE_PATH || 'sqlite';
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.username || 'user'}@${url.host}${url.pathname}`;
  } catch {
    return value;
  }
}

function expectedTableStatus(found: Set<string>) {
  return EXPECTED_TABLES.map((table) => ({ table, exists: found.has(table) }));
}

export async function getDatabaseInfo() {
  const mode = getDatabaseMode();
  const appCommit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';
  const connectionFingerprint = stableFingerprint(connectionIdentity());

  if (mode === 'postgres') {
    const [identityRows, tableRows, migrationRows, rlsRows] = await Promise.all([
      sql`SELECT current_database() AS database_name, current_user AS database_user`,
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      sql`SELECT to_regclass('drizzle.__drizzle_migrations') AS migrations_table`,
      sql`
        SELECT
          c.relname AS table_name,
          c.relrowsecurity AS row_security_enabled,
          c.relforcerowsecurity AS row_security_forced,
          COUNT(p.polname)::int AS policy_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
      `,
    ]);
    const tables = new Set(tableRows.map((row) => String(row.table_name)));
    const rlsByTable = new Map(rlsRows.map((row) => [String(row.table_name), row]));
    return {
      mode,
      databaseName: String(identityRows[0]?.database_name || ''),
      databaseUser: String(identityRows[0]?.database_user || ''),
      appCommit,
      connectionFingerprint,
      migrationsTablePresent: Boolean(migrationRows[0]?.migrations_table),
      expectedTables: expectedTableStatus(tables),
      rlsAudit: RLS_AUDIT_TABLES.map((table) => {
        const row = rlsByTable.get(table);
        return {
          table,
          rowSecurityEnabled: Boolean(row?.row_security_enabled),
          rowSecurityForced: Boolean(row?.row_security_forced),
          policyCount: Number(row?.policy_count || 0),
        };
      }),
    };
  }

  const [databaseRows, tableRows] = await Promise.all([
    sql`PRAGMA database_list`,
    sql`SELECT name AS table_name FROM sqlite_master WHERE type = 'table'`,
  ]);
  const tables = new Set(tableRows.map((row) => String(row.table_name)));
  return {
    mode,
    databaseName: String(databaseRows[0]?.file || 'sqlite'),
    databaseUser: 'local-sqlite',
    appCommit,
    connectionFingerprint,
    migrationsTablePresent: true,
    expectedTables: expectedTableStatus(tables),
    rlsAudit: RLS_AUDIT_TABLES.map((table) => ({
      table,
      rowSecurityEnabled: false,
      rowSecurityForced: false,
      policyCount: 0,
    })),
  };
}
