import type Database from 'better-sqlite3';

export function applyTicketBoardMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_ticket_buckets (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#64748b',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_tickets (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES growth_records(id) ON DELETE SET NULL,
      bucket_id TEXT NOT NULL REFERENCES admin_ticket_buckets(id),
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      requester_email TEXT,
      source TEXT NOT NULL DEFAULT 'admin',
      due_date TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by_user_id TEXT,
      updated_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_ticket_comments (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      ticket_id TEXT NOT NULL REFERENCES admin_tickets(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      author_user_id TEXT,
      author_role TEXT NOT NULL,
      author_name TEXT,
      author_email TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_admin_ticket_buckets_active
      ON admin_ticket_buckets(is_active, sort_order);
    CREATE INDEX IF NOT EXISTS idx_admin_tickets_company_bucket
      ON admin_tickets(company_id, bucket_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_admin_tickets_project
      ON admin_tickets(project_id);
    CREATE INDEX IF NOT EXISTS idx_admin_ticket_comments_ticket_created
      ON admin_ticket_comments(ticket_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_admin_ticket_comments_company_created
      ON admin_ticket_comments(company_id, created_at);
  `);
}
