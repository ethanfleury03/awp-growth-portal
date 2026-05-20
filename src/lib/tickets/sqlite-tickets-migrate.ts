import type Database from 'better-sqlite3';

function addColumnIfMissing(db: Database.Database, table: string, column: string, ddl: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((entry) => entry.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

export function applyTicketMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
      created_by_user_id TEXT,
      created_by_name TEXT,
      created_by_email TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to_user_id TEXT,
      discord_message_id TEXT,
      notification_error TEXT,
      discord_notified_at TEXT,
      solution_summary TEXT,
      solution_details TEXT,
      solution_source TEXT,
      solution_external_id TEXT,
      solution_reported_at TEXT,
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets(company_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_company_status ON tickets(company_id, status);
    CREATE INDEX IF NOT EXISTS idx_tickets_company_activity ON tickets(company_id, last_activity_at);

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      author_user_id TEXT,
      author_role TEXT NOT NULL DEFAULT 'viewer',
      author_name TEXT,
      author_email TEXT,
      body TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_company_ticket ON ticket_comments(company_id, ticket_id);
  `);

  addColumnIfMissing(db, 'tickets', 'solution_summary', 'solution_summary TEXT');
  addColumnIfMissing(db, 'tickets', 'solution_details', 'solution_details TEXT');
  addColumnIfMissing(db, 'tickets', 'solution_source', 'solution_source TEXT');
  addColumnIfMissing(db, 'tickets', 'solution_external_id', 'solution_external_id TEXT');
  addColumnIfMissing(db, 'tickets', 'solution_reported_at', 'solution_reported_at TEXT');
}
