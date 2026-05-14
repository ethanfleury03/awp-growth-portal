import { createHash } from 'node:crypto';
import { getDatabaseMode, sql } from '@/lib/db';

const expectedTables = [
  'companies',
  'company_settings',
  'portal_users',
  'user_memberships',
  'customers',
  'leads',
  'jobs',
  'invoices',
  'estimates',
  'growth_records',
];

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

async function tableRows(mode: 'postgres' | 'sqlite') {
  if (mode === 'postgres') {
    return sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
  }

  return sql`
    SELECT name AS table_name
    FROM sqlite_master
    WHERE type = 'table'
  `;
}

async function identity(mode: 'postgres' | 'sqlite') {
  if (mode === 'postgres') {
    const rows = await sql`
      SELECT current_database() AS database_name, current_user AS user_name
    `;
    return {
      databaseName: String(rows[0]?.database_name || ''),
      userName: String(rows[0]?.user_name || ''),
    };
  }

  return {
    databaseName: 'sqlite',
    userName: 'local',
  };
}

export async function getDatabaseInfo() {
  const mode = getDatabaseMode();
  const [id, tables] = await Promise.all([identity(mode), tableRows(mode)]);
  const found = new Set(tables.map((row) => String(row.table_name)));

  return {
    mode,
    connectionFingerprint: fingerprint(
      process.env.DATABASE_URL || process.env.SQLITE_PATH || 'sqlite:data/plumberos.db',
    ),
    ...id,
    expectedTables: expectedTables.map((table) => ({
      table,
      exists: found.has(table),
    })),
  };
}
