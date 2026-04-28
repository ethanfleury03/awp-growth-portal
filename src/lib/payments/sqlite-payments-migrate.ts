import type Database from 'better-sqlite3';
import { randomBytes } from 'crypto';

function tableColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Payments, company payment policy, invoice cents columns, estimate deposit tracking.
 * Idempotent for existing SQLite DBs.
 */
export function applyPaymentsMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_number_sequences (
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      last_seq INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (company_id, year)
    );

    CREATE TABLE IF NOT EXISTS company_payment_settings (
      company_id TEXT PRIMARY KEY NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      online_payments_enabled INTEGER NOT NULL DEFAULT 0,
      estimate_deposits_enabled INTEGER NOT NULL DEFAULT 0,
      invoice_payments_enabled INTEGER NOT NULL DEFAULT 0,
      deposit_due_timing TEXT NOT NULL DEFAULT 'with_approval',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      stripe_checkout_session_id TEXT,
      stripe_payment_intent_id TEXT,
      stripe_charge_id TEXT,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      status TEXT NOT NULL DEFAULT 'pending',
      customer_email TEXT,
      payment_url TEXT,
      paid_at TEXT,
      failed_at TEXT,
      refunded_at TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
    CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_payments_checkout_session ON payments(stripe_checkout_session_id);

    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY NOT NULL,
      stripe_event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
      processed_at TEXT NOT NULL DEFAULT (datetime('now')),
      payload_json TEXT
    );
  `);

  const est = tableColumns(db, 'estimates');
  if (!est.has('deposit_status')) {
    db.exec(`ALTER TABLE estimates ADD COLUMN deposit_status TEXT NOT NULL DEFAULT 'none'`);
  }
  if (!est.has('deposit_paid_at')) {
    db.exec(`ALTER TABLE estimates ADD COLUMN deposit_paid_at TEXT`);
  }

  const inv = tableColumns(db, 'invoices');
  if (!inv.has('amount_cents')) {
    db.exec(`
      ALTER TABLE invoices ADD COLUMN amount_cents INTEGER;
      ALTER TABLE invoices ADD COLUMN tax_cents INTEGER;
      ALTER TABLE invoices ADD COLUMN total_cents INTEGER;
    `);
    db.exec(`
      UPDATE invoices SET
        amount_cents = CAST(ROUND(amount * 100) AS INTEGER),
        tax_cents = CAST(ROUND(COALESCE(tax, 0) * 100) AS INTEGER),
        total_cents = CAST(ROUND(total * 100) AS INTEGER)
      WHERE amount_cents IS NULL OR total_cents IS NULL;
    `);
  }
  if (!inv.has('public_pay_token')) {
    db.exec(`ALTER TABLE invoices ADD COLUMN public_pay_token TEXT`);
  }
  const inv2 = tableColumns(db, 'invoices');
  if (inv2.has('public_pay_token')) {
    const rows = db.prepare(`SELECT id FROM invoices WHERE public_pay_token IS NULL`).all() as { id: string }[];
    const upd = db.prepare(`UPDATE invoices SET public_pay_token = ? WHERE id = ?`);
    for (const r of rows) {
      upd.run(randomBytes(24).toString('hex'), r.id);
    }
 }
  if (
    !db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_invoices_public_pay_token'`)
      .get()
  ) {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_public_pay_token ON invoices(public_pay_token)`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price_cents INTEGER NOT NULL DEFAULT 0,
      line_total_cents INTEGER NOT NULL DEFAULT 0,
      catalog_service_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
  `);

  // Stripe Connect: companies.stripe_account_id + connect status + onboarding completion.
  const companies = tableColumns(db, 'companies');
  if (!companies.has('stripe_account_id')) {
    db.exec(`ALTER TABLE companies ADD COLUMN stripe_account_id TEXT`);
  }
  if (!companies.has('stripe_connect_status')) {
    db.exec(`ALTER TABLE companies ADD COLUMN stripe_connect_status TEXT DEFAULT 'pending'`);
  }
  if (!companies.has('stripe_onboarding_completed_at')) {
    db.exec(`ALTER TABLE companies ADD COLUMN stripe_onboarding_completed_at TEXT`);
  }
  if (!companies.has('twilio_phone_number')) {
    db.exec(`ALTER TABLE companies ADD COLUMN twilio_phone_number TEXT`);
  }

  // Refund + application-fee tracking on payments.
  const payments = tableColumns(db, 'payments');
  if (!payments.has('stripe_account_id')) {
    db.exec(`ALTER TABLE payments ADD COLUMN stripe_account_id TEXT`);
  }
  if (!payments.has('refunded_amount_cents')) {
    db.exec(`ALTER TABLE payments ADD COLUMN refunded_amount_cents INTEGER NOT NULL DEFAULT 0`);
  }
  if (!payments.has('application_fee_cents')) {
    db.exec(`ALTER TABLE payments ADD COLUMN application_fee_cents INTEGER`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
      stripe_dispute_id TEXT NOT NULL UNIQUE,
      stripe_charge_id TEXT,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      reason TEXT,
      status TEXT NOT NULL,
      evidence_due_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_disputes_company_id ON disputes(company_id);

    CREATE TABLE IF NOT EXISTS webhook_failures (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      event_id TEXT,
      event_type TEXT,
      payload_json TEXT NOT NULL,
      error_message TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_failures_provider_event ON webhook_failures(provider, event_type);
    CREATE INDEX IF NOT EXISTS idx_webhook_failures_unresolved ON webhook_failures(resolved_at);
  `);
}
