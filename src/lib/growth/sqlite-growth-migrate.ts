import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(
    db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
      .get(table),
  );
}

function tableColumns(db: Database.Database, table: string): Set<string> {
  if (!tableExists(db, table)) return new Set();
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function addColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = tableColumns(db, table);
  if (columns.has(column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function applyGrowthMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS growth_records (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      record_type TEXT NOT NULL,
      source_key TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Idea',
      owner TEXT,
      related_record_id TEXT,
      payload_json TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_growth_records_company_type
      ON growth_records(company_id, record_type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_records_source_key
      ON growth_records(company_id, record_type, source_key)
      WHERE source_key IS NOT NULL;
  `);

  if (tableExists(db, 'leads')) {
    addColumn(db, 'leads', 'lead_context_json', 'TEXT');
    addColumn(db, 'leads', 'next_follow_up_at', 'TEXT');
    addColumn(db, 'leads', 'last_contacted_at', 'TEXT');
    addColumn(db, 'leads', 'estimated_value_cents', 'INTEGER');
  }
}
