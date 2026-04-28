CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
  "clerk_user_id" text,
  "stripe_customer_id" text,
  "stripe_subscription_id" text NOT NULL,
  "stripe_checkout_session_id" text,
  "price_id" text,
  "plan" text NOT NULL,
  "status" text NOT NULL DEFAULT 'incomplete',
  "billing_cycle" text NOT NULL DEFAULT 'monthly',
  "trial_ends_at" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "metadata_json" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_billing_subscriptions_stripe_sub"
  ON "billing_subscriptions" ("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "idx_billing_subscriptions_company"
  ON "billing_subscriptions" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_billing_subscriptions_status"
  ON "billing_subscriptions" ("status");
