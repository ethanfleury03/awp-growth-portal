CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "actor_user_id" uuid,
  "actor_email" text,
  "actor_role" text,
  "action" text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "summary" text,
  "metadata" text,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_events_company"
  ON "audit_events" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_events_entity"
  ON "audit_events" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "privacy_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "requested_by_user_id" uuid,
  "completed_at" timestamp with time zone,
  "payload" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_privacy_requests_company"
  ON "privacy_requests" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_privacy_requests_customer"
  ON "privacy_requests" USING btree ("customer_id");
