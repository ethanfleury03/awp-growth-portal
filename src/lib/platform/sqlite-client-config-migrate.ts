import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(
    db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`).get(table),
  );
}

function columnExists(db: Database.Database, table: string, col: string): boolean {
  if (!tableExists(db, table)) return false;
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === col);
}

export function applyClientConfigMigrations(db: Database.Database) {
  if (tableExists(db, 'audit_logs')) {
    for (const [col, type] of [
      ['actor_email', 'TEXT'],
      ['actor_role', 'TEXT'],
      ['summary', 'TEXT'],
      ['metadata', 'TEXT'],
      ['user_agent', 'TEXT'],
    ] as const) {
      if (!columnExists(db, 'audit_logs', col)) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN ${col} ${type}`);
      }
    }
  }

  if (tableExists(db, 'feature_flags')) {
    if (!columnExists(db, 'feature_flags', 'flag_key')) {
      db.exec(`ALTER TABLE feature_flags ADD COLUMN flag_key TEXT`);
    }
    if (!columnExists(db, 'feature_flags', 'enabled')) {
      db.exec(`ALTER TABLE feature_flags ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0`);
    }
    if (!columnExists(db, 'feature_flags', 'payload_json')) {
      db.exec(`ALTER TABLE feature_flags ADD COLUMN payload_json TEXT`);
    }
    if (columnExists(db, 'feature_flags', 'key')) {
      db.exec(`
        UPDATE feature_flags
        SET
          flag_key = COALESCE(flag_key, key),
          enabled = CASE
            WHEN lower(COALESCE(value, 'false')) IN ('true', '1', 'yes', 'on') THEN 1
            ELSE COALESCE(enabled, 0)
          END
        WHERE flag_key IS NULL
      `);
    }
    db.exec(`
      DROP INDEX IF EXISTS idx_feature_flags_company_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_company_key
        ON feature_flags(company_id, flag_key);
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS company_settings (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      legal_name TEXT,
      industry TEXT NOT NULL DEFAULT 'generic',
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      logo_url TEXT,
      primary_color TEXT NOT NULL DEFAULT '#f26a1f',
      accent_color TEXT NOT NULL DEFAULT '#2563eb',
      portal_title TEXT NOT NULL DEFAULT 'WNY Automation Portal',
      workspace_label TEXT NOT NULL DEFAULT 'Automation workspace',
      default_route TEXT NOT NULL DEFAULT '/app',
      config_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO company_settings (company_id, display_name, legal_name)
    SELECT id, name, name FROM companies;

    CREATE TABLE IF NOT EXISTS company_custom_fields (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      field_key TEXT NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      required INTEGER NOT NULL DEFAULT 0,
      options_json TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_company_custom_fields_company_entity
      ON company_custom_fields(company_id, entity_type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_company_custom_fields_unique
      ON company_custom_fields(company_id, entity_type, field_key);

    CREATE TABLE IF NOT EXISTS company_pipeline_stages (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      stage_key TEXT NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#2563eb',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_company_pipeline_stages_company_entity
      ON company_pipeline_stages(company_id, entity_type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_company_pipeline_stages_unique
      ON company_pipeline_stages(company_id, entity_type, stage_key);

    CREATE TABLE IF NOT EXISTS unassigned_portal_users (
      email TEXT PRIMARY KEY,
      clerk_user_id TEXT,
      name TEXT,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      assigned_at TEXT,
      assigned_company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
      assigned_user_id TEXT REFERENCES portal_users(id) ON DELETE SET NULL,
      metadata_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_unassigned_portal_users_last_seen
      ON unassigned_portal_users(last_seen_at);
  `);
}
