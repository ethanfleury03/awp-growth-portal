ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "current_period_start" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "billing_usage_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "stripe_customer_id" text,
  "stripe_subscription_id" text NOT NULL,
  "stripe_invoice_id" text,
  "stripe_invoice_item_id" text,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "provider_cost_usd" text NOT NULL DEFAULT '0',
  "multiplier" text NOT NULL DEFAULT '2',
  "charge_amount_cents" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'usd',
  "status" text NOT NULL DEFAULT 'pending',
  "metadata_json" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_billing_usage_periods_sub_period"
  ON "billing_usage_periods" ("stripe_subscription_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "idx_billing_usage_periods_company"
  ON "billing_usage_periods" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_billing_usage_periods_invoice"
  ON "billing_usage_periods" ("stripe_invoice_id");
CREATE INDEX IF NOT EXISTS "idx_billing_usage_periods_status"
  ON "billing_usage_periods" ("status");
