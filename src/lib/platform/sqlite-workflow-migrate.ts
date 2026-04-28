import type Database from 'better-sqlite3';

function tableColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(
    db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
      .get(table),
  );
}

/**
 * Phase 4 workflow tables: attachments (R2-backed uploads), notifications
 * (email/SMS delivery log), service_contracts + schedules (recurring work),
 * and consent columns on customers.
 */
export function applyWorkflowMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      file_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      uploaded_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_attachments_company ON attachments(company_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
      channel TEXT NOT NULL,
      template TEXT NOT NULL,
      to_address TEXT NOT NULL,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      related_entity_type TEXT,
      related_entity_id TEXT,
      subject TEXT,
      body TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      provider_message_id TEXT,
      error_message TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

    CREATE TABLE IF NOT EXISTS service_contracts (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      cadence TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      next_due_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_service_contracts_company ON service_contracts(company_id);

    CREATE TABLE IF NOT EXISTS service_contract_schedules (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      contract_id TEXT NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
      scheduled_for TEXT NOT NULL,
      job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_schedules_contract ON service_contract_schedules(contract_id);
  `);

  if (tableExists(db, 'jobs')) {
    const cols = tableColumns(db, 'jobs');
    if (!cols.has('scheduled_at')) {
      db.exec(`ALTER TABLE jobs ADD COLUMN scheduled_at TEXT`);
      db.exec(`
        UPDATE jobs
        SET scheduled_at = CASE
          WHEN scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL
            THEN scheduled_date || ' ' || scheduled_time || ':00'
          WHEN scheduled_date IS NOT NULL
            THEN scheduled_date || ' 09:00:00'
          ELSE NULL
        END
        WHERE scheduled_at IS NULL
      `);
    }
  }

  if (tableExists(db, 'customers')) {
    const cols = tableColumns(db, 'customers');
    if (!cols.has('email_opt_in')) {
      db.exec(`ALTER TABLE customers ADD COLUMN email_opt_in INTEGER NOT NULL DEFAULT 1`);
    }
    if (!cols.has('sms_opt_in')) {
      db.exec(`ALTER TABLE customers ADD COLUMN sms_opt_in INTEGER NOT NULL DEFAULT 1`);
    }
    if (!cols.has('sms_opt_out_at')) {
      db.exec(`ALTER TABLE customers ADD COLUMN sms_opt_out_at TEXT`);
    }
    if (!cols.has('portal_token')) {
      db.exec(`ALTER TABLE customers ADD COLUMN portal_token TEXT`);
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_portal_token
      ON customers(portal_token) WHERE portal_token IS NOT NULL
    `);
  }

  if (tableExists(db, 'estimates')) {
    const cols = tableColumns(db, 'estimates');
    if (!cols.has('signature_attachment_id')) {
      db.exec(`ALTER TABLE estimates ADD COLUMN signature_attachment_id TEXT`);
    }
    if (!cols.has('signed_at')) {
      db.exec(`ALTER TABLE estimates ADD COLUMN signed_at TEXT`);
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      actor_user_id TEXT,
      actor_email TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      summary TEXT,
      metadata TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_events(company_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS privacy_requests (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by_user_id TEXT,
      completed_at TEXT,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_privacy_company ON privacy_requests(company_id);
    CREATE INDEX IF NOT EXISTS idx_privacy_customer ON privacy_requests(customer_id);

    CREATE TABLE IF NOT EXISTS feature_flags (
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      flag_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      payload TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (company_id, flag_key)
    );
  `);
}
