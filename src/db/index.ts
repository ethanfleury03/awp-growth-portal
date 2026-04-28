/**
 * Postgres client (Neon serverless via `@neondatabase/serverless`).
 *
 * Every request that touches tenant-scoped tables should run through
 * `withTenant(companyId, async (tx) => ...)`, which begins a transaction and
 * runs `SET LOCAL app.company_id = $1`. RLS policies on tenant tables use
 * `current_setting('app.company_id')` to enforce isolation at the DB layer.
 *
 * For super-admin or webhook work that legitimately needs cross-tenant access,
 * use `withSuperAdmin(async (tx) => ...)` — it sets `app.role = 'super_admin'`
 * which the RLS policies honor as a bypass.
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema';

let _pool: Pool | null = null;
export function getPool(): Pool {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Running in SQLite dev mode — do not call Postgres helpers.',
    );
  }
  _pool = new Pool({ connectionString: url });
  return _pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export type Database = ReturnType<typeof getDb>;

export function isPostgresEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Run `fn` inside a transaction with `app.company_id` set for RLS. */
export async function withTenant<T>(
  companyId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      (await import('drizzle-orm')).sql.raw(
        `SET LOCAL app.company_id = '${companyId.replace(/'/g, "''")}'`,
      ),
    );
    return fn(tx as unknown as Database);
  });
}

export async function withSuperAdmin<T>(
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      (await import('drizzle-orm')).sql.raw(`SET LOCAL app.role = 'super_admin'`),
    );
    return fn(tx as unknown as Database);
  });
}

export { schema };
