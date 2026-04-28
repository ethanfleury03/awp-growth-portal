/**
 * Phase 1 tenancy hardening: adds `company_id` to tables that were global.
 *
 * Idempotent: columns/indexes are only added when missing. Backfills point at
 * the oldest company so existing dev data keeps working; production deployments
 * should set `company_id` explicitly before relying on this fallback.
 */
import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(
    db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
      .get(table),
  );
}

function columnExists(db: Database.Database, table: string, col: string): boolean {
  if (!tableExists(db, table)) return false;
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === col);
}

function firstCompanyId(db: Database.Database): string | null {
  const row = db
    .prepare(`SELECT id FROM companies ORDER BY datetime(created_at) ASC LIMIT 1`)
    .get() as { id?: string } | undefined;
  return row?.id ?? null;
}

export function applyTenancyMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_phone_numbers (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      phone_e164 TEXT NOT NULL UNIQUE,
      label TEXT,
      provider TEXT DEFAULT 'twilio',
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_company_phone_numbers_company
      ON company_phone_numbers(company_id);
  `);

  addCompanyIdTo(db, 'buckets');
  addCompanyIdTo(db, 'receptionist_settings', { unique: true });
  addCompanyIdTo(db, 'receptionist_calls');
  addCompanyIdTo(db, 'receptionist_mock_scenarios');

  if (tableExists(db, 'buckets') && columnExists(db, 'buckets', 'company_id')) {
    try {
      db.exec(`DROP INDEX IF EXISTS sqlite_autoindex_buckets_1`);
    } catch {
      /* ignore */
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_buckets_company ON buckets(company_id);
    `);
  }
}

function addCompanyIdTo(
  db: Database.Database,
  table: string,
  opts?: { unique?: boolean },
) {
  if (!tableExists(db, table)) return;
  if (columnExists(db, table, 'company_id')) return;

  db.exec(`ALTER TABLE ${table} ADD COLUMN company_id TEXT REFERENCES companies(id) ON DELETE CASCADE`);

  const firstCompany = firstCompanyId(db);
  if (firstCompany) {
    db.prepare(`UPDATE ${table} SET company_id = ? WHERE company_id IS NULL`).run(firstCompany);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_company_id ON ${table}(company_id)`);
  if (opts?.unique) {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_company_id_unique ON ${table}(company_id) WHERE company_id IS NOT NULL`,
    );
  }
}
