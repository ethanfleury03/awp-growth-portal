import type Database from 'better-sqlite3';

/**
 * SQLite-only compatibility migration for marketing subscription state.
 * Postgres uses Drizzle SQL migrations for the same table.
 */
export function applyMarketingMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      clerk_user_id TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT NOT NULL UNIQUE,
      stripe_checkout_session_id TEXT,
      price_id TEXT,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'incomplete',
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      trial_ends_at TEXT,
      current_period_end TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_company
      ON billing_subscriptions(company_id);
    CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
      ON billing_subscriptions(status);

    CREATE TABLE IF NOT EXISTS marketing_leads (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      phone TEXT,
      trade TEXT,
      message TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_marketing_leads_kind ON marketing_leads(kind);
    CREATE INDEX IF NOT EXISTS idx_marketing_leads_email ON marketing_leads(email);
    CREATE INDEX IF NOT EXISTS idx_marketing_leads_created ON marketing_leads(created_at);
  `);
}
