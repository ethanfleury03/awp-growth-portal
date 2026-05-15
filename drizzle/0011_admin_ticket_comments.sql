CREATE TABLE IF NOT EXISTS "admin_ticket_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "admin_tickets"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "author_user_id" text,
  "author_role" text NOT NULL,
  "author_name" text,
  "author_email" text,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_admin_ticket_comments_ticket_created"
  ON "admin_ticket_comments" ("ticket_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_admin_ticket_comments_company_created"
  ON "admin_ticket_comments" ("company_id", "created_at");

ALTER TABLE "admin_ticket_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_ticket_comments" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON "admin_ticket_comments";
CREATE POLICY tenant_isolation_select ON "admin_ticket_comments" FOR SELECT USING (
  app_is_super_admin() OR company_id = app_current_company()
);

DROP POLICY IF EXISTS tenant_isolation_mod ON "admin_ticket_comments";
CREATE POLICY tenant_isolation_mod ON "admin_ticket_comments" FOR ALL USING (
  app_is_super_admin() OR company_id = app_current_company()
) WITH CHECK (
  app_is_super_admin() OR company_id = app_current_company()
);
