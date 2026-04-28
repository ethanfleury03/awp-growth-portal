import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(
    db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
      .get(table),
  );
}

function tableColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function ensureBranchIdColumn(db: Database.Database, table: string) {
  if (!tableExists(db, table)) return;
  const columns = tableColumns(db, table);
  if (columns.has('branch_id') || !columns.has('company_id')) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN branch_id TEXT`);
}

function backfillBranchId(db: Database.Database, table: string) {
  if (!tableExists(db, table)) return;
  const columns = tableColumns(db, table);
  if (!columns.has('branch_id') || !columns.has('company_id')) return;
  db.exec(`
    UPDATE ${table}
    SET branch_id = (
      SELECT id
      FROM branches
      WHERE branches.company_id = ${table}.company_id
      ORDER BY is_primary DESC, datetime(created_at) ASC
      LIMIT 1
    )
    WHERE branch_id IS NULL AND company_id IS NOT NULL
  `);
}

export function applyPlatformMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      phone TEXT,
      address TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_branches_company_id ON branches(company_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_company_primary ON branches(company_id)
      WHERE is_primary = 1;

    CREATE TABLE IF NOT EXISTS user_memberships (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      user_id TEXT NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_user_memberships_user_id ON user_memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_memberships_company_id ON user_memberships(company_id);

    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'company',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(role, permission, scope)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      payload_json TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_id ON audit_logs(branch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      created_by_user_id TEXT,
      last_used_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON api_keys(company_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_branch_id ON api_keys(branch_id);

    CREATE TABLE IF NOT EXISTS integration_connections (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
      provider TEXT NOT NULL,
      external_account_id TEXT,
      status TEXT NOT NULL DEFAULT 'disconnected',
      config_json TEXT,
      last_synced_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_integration_connections_company_id
      ON integration_connections(company_id);
    CREATE INDEX IF NOT EXISTS idx_integration_connections_branch_id
      ON integration_connections(branch_id);
  `);

  db.exec(`
    INSERT INTO branches (id, company_id, name, phone, address, is_primary)
    SELECT uuid(), c.id, 'Main', c.phone, c.address, 1
    FROM companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM branches b WHERE b.company_id = c.id
    )
  `);

  if (tableExists(db, 'portal_users')) {
    db.exec(`
      INSERT INTO user_memberships (id, user_id, company_id, branch_id, role, status)
      SELECT
        uuid(),
        u.id,
        u.company_id,
        (
          SELECT id
          FROM branches b
          WHERE b.company_id = u.company_id
          ORDER BY b.is_primary DESC, datetime(b.created_at) ASC
          LIMIT 1
        ),
        COALESCE(NULLIF(u.role, ''), 'staff'),
        CASE WHEN COALESCE(u.is_active, 1) = 1 THEN 'active' ELSE 'inactive' END
      FROM portal_users u
      WHERE u.company_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM user_memberships m
          WHERE m.user_id = u.id AND m.company_id = u.company_id
        )
    `);
  }

  const branchScopedTables = [
    'plumbers',
    'customers',
    'leads',
    'jobs',
    'invoices',
    'call_logs',
    'estimates',
    'receptionist_calls',
    'payments',
  ];

  for (const table of branchScopedTables) {
    ensureBranchIdColumn(db, table);
    backfillBranchId(db, table);
  }
}
