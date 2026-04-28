CREATE TABLE IF NOT EXISTS "marketing_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "company" text,
  "phone" text,
  "trade" text,
  "message" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "referrer" text,
  "user_agent" text,
  "ip_hash" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_marketing_leads_kind"
  ON "marketing_leads" ("kind");
CREATE INDEX IF NOT EXISTS "idx_marketing_leads_email"
  ON "marketing_leads" ("email");
CREATE INDEX IF NOT EXISTS "idx_marketing_leads_created"
  ON "marketing_leads" ("created_at");
