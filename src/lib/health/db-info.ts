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
    const [identityRows, tableRows, migrationRows] = await Promise.all([
      sql`SELECT current_database() AS database_name, current_user AS database_user`,
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      sql`SELECT to_regclass('drizzle.__drizzle_migrations') AS migrations_table`,
    ]);
    const tables = new Set(tableRows.map((row) => String(row.table_name)));
    return {
      mode,
      databaseName: String(identityRows[0]?.database_name || ''),
      databaseUser: String(identityRows[0]?.database_user || ''),
      appCommit,
      connectionFingerprint,
      migrationsTablePresent: Boolean(migrationRows[0]?.migrations_table),
      expectedTables: expectedTableStatus(tables),
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
  };
}
