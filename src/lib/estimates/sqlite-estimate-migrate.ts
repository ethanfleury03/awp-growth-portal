import type Database from 'better-sqlite3';

function tableColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Idempotent DDL for estimate tables (existing DBs skip full schema.sql replay).
 */
export function applyEstimatesMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS estimate_number_sequences (
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      last_seq INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (company_id, year)
    );

    CREATE TABLE IF NOT EXISTS estimate_settings (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
      company_name TEXT NOT NULL,
      logo_url TEXT,
      accent_color TEXT,
      estimate_footer_text TEXT,
      default_terms_text TEXT,
      default_expiration_days INTEGER NOT NULL DEFAULT 30,
      default_tax_rate_basis_points INTEGER,
      estimate_prefix TEXT NOT NULL DEFAULT 'EST',
      default_deposit_enabled INTEGER NOT NULL DEFAULT 0,
      default_deposit_percent_basis_points INTEGER,
      customer_signature_required INTEGER NOT NULL DEFAULT 0,
      allow_customer_reject INTEGER NOT NULL DEFAULT 1,
      public_approval_requires_token INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS estimates (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      estimate_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft',
      title TEXT NOT NULL,
      description TEXT,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
      receptionist_call_id TEXT REFERENCES receptionist_calls(id) ON DELETE SET NULL,
      source_type TEXT,
      source_id TEXT,
      created_by_plumber_id TEXT REFERENCES plumbers(id) ON DELETE SET NULL,
      assigned_to_plumber_id TEXT REFERENCES plumbers(id) ON DELETE SET NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      subtotal_amount_cents INTEGER NOT NULL DEFAULT 0,
      discount_amount_cents INTEGER NOT NULL DEFAULT 0,
      tax_amount_cents INTEGER NOT NULL DEFAULT 0,
      total_amount_cents INTEGER NOT NULL DEFAULT 0,
      deposit_amount_cents INTEGER,
      company_name_snapshot TEXT NOT NULL,
      company_email_snapshot TEXT,
      company_phone_snapshot TEXT,
      company_address_snapshot TEXT,
      customer_name_snapshot TEXT NOT NULL,
      customer_email_snapshot TEXT,
      customer_phone_snapshot TEXT,
      service_address_snapshot TEXT,
      notes_internal TEXT,
      notes_customer TEXT,
      expiration_date TEXT,
      sent_at TEXT,
      viewed_at TEXT,
      approved_at TEXT,
      rejected_at TEXT,
      expired_at TEXT,
      converted_to_job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
      customer_public_token TEXT NOT NULL UNIQUE,
      version_number INTEGER NOT NULL DEFAULT 1,
      parent_estimate_id TEXT,
      selected_option_group TEXT,
      tax_rate_basis_points INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS estimate_line_items (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      name TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'ea',
      unit_price_cents INTEGER NOT NULL DEFAULT 0,
      total_price_cents INTEGER NOT NULL DEFAULT 0,
      is_optional INTEGER NOT NULL DEFAULT 0,
      is_taxable INTEGER NOT NULL DEFAULT 1,
      option_group TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS estimate_activity (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      actor_type TEXT NOT NULL DEFAULT 'system',
      actor_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS estimate_delivery (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      delivery_type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT,
      body_snapshot TEXT,
      provider TEXT NOT NULL,
      provider_message_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TEXT,
      failed_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS estimate_catalog_services (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      unit_price_cents INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_estimate_catalog_services_company ON estimate_catalog_services(company_id);

    CREATE INDEX IF NOT EXISTS idx_estimates_company ON estimates(company_id);
    CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
    CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
    CREATE INDEX IF NOT EXISTS idx_estimates_lead ON estimates(lead_id);
    CREATE INDEX IF NOT EXISTS idx_estimates_job ON estimates(job_id);
    CREATE INDEX IF NOT EXISTS idx_estimates_receptionist_call ON estimates(receptionist_call_id);
    CREATE INDEX IF NOT EXISTS idx_estimates_created ON estimates(created_at);
    CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate ON estimate_line_items(estimate_id);
    CREATE INDEX IF NOT EXISTS idx_estimate_activity_estimate ON estimate_activity(estimate_id);
    CREATE INDEX IF NOT EXISTS idx_estimate_delivery_estimate ON estimate_delivery(estimate_id);
  `);

  const jobs = tableColumns(db, 'jobs');
  if (!jobs.has('source_estimate_id')) {
    db.exec('ALTER TABLE jobs ADD COLUMN source_estimate_id TEXT');
  }
}
