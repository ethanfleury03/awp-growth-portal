import type Database from 'better-sqlite3';

function tableColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

export function applyBillingMigrations(db: Database.Database) {
  const subscriptionCols = tableColumns(db, 'billing_subscriptions');
  if (subscriptionCols.size && !subscriptionCols.has('current_period_start')) {
    db.exec(`ALTER TABLE billing_subscriptions ADD COLUMN current_period_start TEXT`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_usage_periods (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT NOT NULL,
      stripe_invoice_id TEXT,
      stripe_invoice_item_id TEXT,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      provider_cost_usd TEXT NOT NULL DEFAULT '0',
      multiplier TEXT NOT NULL DEFAULT '2',
      charge_amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      status TEXT NOT NULL DEFAULT 'pending',
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(stripe_subscription_id, period_start, period_end)
    );

    CREATE INDEX IF NOT EXISTS idx_billing_usage_periods_company
      ON billing_usage_periods(company_id);
    CREATE INDEX IF NOT EXISTS idx_billing_usage_periods_invoice
      ON billing_usage_periods(stripe_invoice_id);
    CREATE INDEX IF NOT EXISTS idx_billing_usage_periods_status
      ON billing_usage_periods(status);
  `);
}
