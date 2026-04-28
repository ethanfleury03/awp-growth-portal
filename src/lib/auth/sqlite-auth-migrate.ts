import type Database from 'better-sqlite3';

function tables(db: Database.Database): Set<string> {
  const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function cols(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Idempotent migration for portal_users and user_sessions tables.
 * Called at DB init so existing DBs get the tables added automatically.
 */
export function applyAuthMigrations(db: Database.Database) {
  const t = tables(db);

  if (!t.has('portal_users')) {
    db.exec(`
      CREATE TABLE portal_users (
        id          TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
        company_id  TEXT REFERENCES companies(id) ON DELETE SET NULL,
        email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name        TEXT NOT NULL DEFAULT '',
        hashed_pw   TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'staff',
        is_active   INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);
    `);
  }

  if (!t.has('user_sessions')) {
    db.exec(`
      CREATE TABLE user_sessions (
        id          TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
        user_id     TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
        token       TEXT NOT NULL UNIQUE,
        expires_at  TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
    `);
  }

  // Safe column additions for older DBs
  if (t.has('portal_users')) {
    const c = cols(db, 'portal_users');
    if (!c.has('is_active')) db.exec(`ALTER TABLE portal_users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`);
    if (!c.has('clerk_user_id')) db.exec(`ALTER TABLE portal_users ADD COLUMN clerk_user_id TEXT`);
    // clerk_user_id unique only when set
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_users_clerk_user_id ON portal_users(clerk_user_id) WHERE clerk_user_id IS NOT NULL`,
    );
  }
}
