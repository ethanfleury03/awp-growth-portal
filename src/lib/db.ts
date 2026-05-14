/**
 * Unified `sql` tagged-template shim.
 *
 * Two drivers:
 *   - Postgres (Neon serverless) when `DATABASE_URL` is set — production target.
 *   - SQLite (better-sqlite3) otherwise — dev/test target.
 *
 * Both drivers consume the same tagged-template API so existing route handlers
 * do not need to change. SQL differences (ILIKE vs LIKE, NOW() vs datetime(),
 * etc.) are normalized per-dialect.
 */

import Database from 'better-sqlite3';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { applyReceptionistMigrations } from '@/lib/receptionist/sqlite-migrate';
import { applyEstimatesMigrations } from '@/lib/estimates/sqlite-estimate-migrate';
import { applyAuthMigrations } from '@/lib/auth/sqlite-auth-migrate';
import { applyPaymentsMigrations } from '@/lib/payments/sqlite-payments-migrate';
import { applyPlatformMigrations } from '@/lib/platform/sqlite-platform-migrate';
import { applyTenancyMigrations } from '@/lib/platform/sqlite-tenancy-migrate';
import { applyWorkflowMigrations } from '@/lib/platform/sqlite-workflow-migrate';
import { applyMarketingMigrations } from '@/lib/marketing/sqlite-marketing-migrate';
import { applyBillingMigrations } from '@/lib/billing/sqlite-billing-migrate';
import { applyGrowthMigrations } from '@/lib/growth/sqlite-growth-migrate';
import { applyAiMigrations } from '@/lib/ai/sqlite-ai-migrate';
import { applyClientConfigMigrations } from '@/lib/platform/sqlite-client-config-migrate';
import { applyMarketingAgentMigrations } from '@/lib/marketing-agent/sqlite-marketing-agent-migrate';

type PgPoolType = import('@neondatabase/serverless').Pool;
type SqlRuntimeContext = {
  companyId?: string;
  role?: 'super_admin';
};

const sqlRuntimeContext = new AsyncLocalStorage<SqlRuntimeContext>();

export function getSqlRuntimeContext(): SqlRuntimeContext | undefined {
  return sqlRuntimeContext.getStore();
}

export function enterTenantContext(companyId: string) {
  const normalizedCompanyId = companyId.trim();
  if (!normalizedCompanyId) return;
  sqlRuntimeContext.enterWith({
    ...(sqlRuntimeContext.getStore() || {}),
    companyId: normalizedCompanyId,
  });
}

export async function withTenantContext<T>(
  companyId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const normalizedCompanyId = companyId.trim();
  if (!normalizedCompanyId) {
    throw new Error('withTenantContext requires a companyId');
  }
  return sqlRuntimeContext.run(
    {
      ...(sqlRuntimeContext.getStore() || {}),
      companyId: normalizedCompanyId,
    },
    fn,
  );
}

export async function withSuperAdminContext<T>(fn: () => Promise<T>): Promise<T> {
  return sqlRuntimeContext.run(
    {
      ...(sqlRuntimeContext.getStore() || {}),
      role: 'super_admin',
    },
    fn,
  );
}

export function getDatabaseMode(env: NodeJS.ProcessEnv = process.env): 'postgres' | 'sqlite' {
  return env.DATABASE_URL ? 'postgres' : 'sqlite';
}

export function requiresManagedPostgres(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL === '1' || Boolean(env.VERCEL_ENV);
}

export function assertSqliteSafeForRuntime(env: NodeJS.ProcessEnv = process.env): void {
  if (env.DATABASE_URL) {
    throw new Error(
      'getDb() is SQLite-only and cannot be used when DATABASE_URL is set. Use the sql tagged template for portable database access.',
    );
  }
  if (requiresManagedPostgres(env)) {
    throw new Error(
      'DATABASE_URL is required in production/hosted environments. Refusing to use the SQLite fallback for client data.',
    );
  }
}

function isPostgres(): boolean {
  return getDatabaseMode() === 'postgres';
}

let pgPool: PgPoolType | null = null;
function getPgPool(): PgPoolType {
  if (pgPool) return pgPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Postgres database access.');
  }
  // Loaded lazily so that SQLite-only dev/test environments don't pay the
  // import cost and don't require the Neon driver to be installed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('@neondatabase/serverless') as typeof import('@neondatabase/serverless');
  pgPool = new Pool({ connectionString });
  return pgPool!;
}

// ---------------- SQLite path ---------------------------------------------

function bindValue(v: unknown): unknown {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return Number(v);
  return v;
}

function normalizeSqliteDialect(text: string): string {
  return text
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\bNOW\(\)/g, "datetime('now')");
}

function normalizePgDialect(text: string): string {
  // SQLite-isms sometimes used in routes that we want to keep portable.
  return text.replace(/\bdatetime\('now'\)/g, 'NOW()');
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === 'bigint' ? Number(v) : v;
    }
    return out;
  });
}

function flattenSqliteFragments(
  strings: TemplateStringsArray,
  values: readonly unknown[],
): { text: string; args: unknown[] } {
  let text = '';
  const args: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      const v = values[i];
      if (v instanceof SqlQuery) {
        const inner = flattenSqliteFragments(v.strings, v.values);
        text += inner.text;
        args.push(...inner.args);
      } else {
        text += '?';
        args.push(v);
      }
    }
  }
  return { text, args };
}

function flattenPgFragments(
  strings: TemplateStringsArray,
  values: readonly unknown[],
  nextParamIndex = { i: 1 },
): { text: string; args: unknown[] } {
  let text = '';
  const args: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      const v = values[i];
      if (v instanceof SqlQuery) {
        const inner = flattenPgFragments(v.strings, v.values, nextParamIndex);
        text += inner.text;
        args.push(...inner.args);
      } else {
        text += `$${nextParamIndex.i++}`;
        args.push(v);
      }
    }
  }
  return { text, args };
}

let dbInstance: Database.Database | null = null;

export function resetSqliteSingletonForTests() {
  if (process.env.NODE_ENV !== 'test') return;
  try {
    dbInstance?.close();
  } catch {
    /* ignore */
  }
  dbInstance = null;
}

function ensureCommittedSchema(db: Database.Database) {
  const hasReceptionist = db
    .prepare(
      `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'receptionist_calls' LIMIT 1`,
    )
    .get() as { ok: number } | undefined;
  if (hasReceptionist) return;

  const schemaPath = path.join(process.cwd(), 'data', 'schema.sqlite.sql');
  if (!fs.existsSync(schemaPath)) {
    console.warn('[db] Missing schema file, skipping auto-migrate:', schemaPath);
    return;
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

export function getDb(): Database.Database {
  assertSqliteSafeForRuntime();
  if (dbInstance) {
    return dbInstance;
  }

  const file =
    process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'plumberos.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });

  dbInstance = new Database(file);
  dbInstance.pragma('journal_mode = DELETE');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.function('uuid', () => randomUUID());
  ensureCommittedSchema(dbInstance);
  applyReceptionistMigrations(dbInstance);
  applyEstimatesMigrations(dbInstance);
  applyPaymentsMigrations(dbInstance);
  applyAuthMigrations(dbInstance);
  applyPlatformMigrations(dbInstance);
  applyTenancyMigrations(dbInstance);
  applyWorkflowMigrations(dbInstance);
  applyMarketingMigrations(dbInstance);
  applyBillingMigrations(dbInstance);
  applyGrowthMigrations(dbInstance);
  applyAiMigrations(dbInstance);
  applyMarketingAgentMigrations(dbInstance);
  applyClientConfigMigrations(dbInstance);

  return dbInstance;
}

export class SqlQuery implements PromiseLike<Record<string, unknown>[]> {
  constructor(
    readonly strings: TemplateStringsArray,
    readonly values: readonly unknown[],
  ) {}

  private runSqlite(): Record<string, unknown>[] {
    let { text, args } = flattenSqliteFragments(this.strings, this.values);
    text = normalizeSqliteDialect(text);
    args = args.map(bindValue);

    const db = getDb();
    const stmt = db.prepare(text);
    const head = text.trim().toUpperCase();
    if (head.includes('RETURNING') || head.startsWith('SELECT') || head.startsWith('WITH') || head.startsWith('PRAGMA')) {
      return normalizeRows(stmt.all(...args) as Record<string, unknown>[]);
    }
    stmt.run(...args);
    return [];
  }

  private async runPostgres(): Promise<Record<string, unknown>[]> {
    const flat = flattenPgFragments(this.strings, this.values);
    const text = normalizePgDialect(flat.text);
    const args = flat.args;

    const pool = getPgPool();
    const context = getSqlRuntimeContext();
    if (!context?.companyId && context?.role !== 'super_admin') {
      const res = await pool.query(text, args as unknown[]);
      // Neon's query returns rows for anything returning; INSERT without
      // RETURNING resolves with rows=[].
      return (res.rows as Record<string, unknown>[]) || [];
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (context.role === 'super_admin') {
        await client.query(`SELECT set_config('app.role', 'super_admin', true)`);
      }
      if (context.companyId) {
        await client.query(`SELECT set_config('app.company_id', $1, true)`, [context.companyId]);
      }
      const res = await client.query(text, args as unknown[]);
      await client.query('COMMIT');
      return (res.rows as Record<string, unknown>[]) || [];
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  then<TResult1 = Record<string, unknown>[], TResult2 = never>(
    onfulfilled?:
      | ((value: Record<string, unknown>[]) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const run = isPostgres()
      ? Promise.resolve().then(() => this.runPostgres())
      : Promise.resolve().then(() => this.runSqlite());
    return run.then(onfulfilled, onrejected);
  }
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
  return new SqlQuery(strings, values);
}
