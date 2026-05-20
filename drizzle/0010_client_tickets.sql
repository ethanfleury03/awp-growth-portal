CREATE TABLE IF NOT EXISTS "tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "branch_id" uuid REFERENCES "branches"("id") ON DELETE set null,
  "created_by_user_id" text,
  "created_by_name" text,
  "created_by_email" text,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "category" text DEFAULT 'general' NOT NULL,
  "priority" text DEFAULT 'normal' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "assigned_to_user_id" text,
  "discord_message_id" text,
  "notification_error" text,
  "discord_notified_at" timestamp with time zone,
  "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_company"
  ON "tickets" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_company_status"
  ON "tickets" USING btree ("company_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_company_activity"
  ON "tickets" USING btree ("company_id","last_activity_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "author_user_id" text,
  "author_role" text DEFAULT 'viewer' NOT NULL,
  "author_name" text,
  "author_email" text,
  "body" text NOT NULL,
  "is_internal" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_comments_ticket"
  ON "ticket_comments" USING btree ("ticket_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_comments_company_ticket"
  ON "ticket_comments" USING btree ("company_id","ticket_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS boolean AS $$
  SELECT COALESCE(current_setting('app.role', true), '') = 'super_admin';
$$ LANGUAGE sql STABLE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_company() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;
--> statement-breakpoint
ALTER TABLE "tickets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tickets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_select ON "tickets";
--> statement-breakpoint
CREATE POLICY tenant_isolation_select ON "tickets" FOR SELECT USING (
  app_is_super_admin() OR company_id = app_current_company()
);
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_mod ON "tickets";
--> statement-breakpoint
CREATE POLICY tenant_isolation_mod ON "tickets" FOR ALL USING (
  app_is_super_admin() OR company_id = app_current_company()
) WITH CHECK (
  app_is_super_admin() OR company_id = app_current_company()
);
--> statement-breakpoint
ALTER TABLE "ticket_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ticket_comments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_select ON "ticket_comments";
--> statement-breakpoint
CREATE POLICY tenant_isolation_select ON "ticket_comments" FOR SELECT USING (
  app_is_super_admin() OR company_id = app_current_company()
);
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_mod ON "ticket_comments";
--> statement-breakpoint
CREATE POLICY tenant_isolation_mod ON "ticket_comments" FOR ALL USING (
  app_is_super_admin() OR company_id = app_current_company()
) WITH CHECK (
  app_is_super_admin() OR company_id = app_current_company()
);
