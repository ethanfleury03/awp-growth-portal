CREATE TABLE IF NOT EXISTS "unassigned_portal_users" (
  "email" text PRIMARY KEY,
  "clerk_user_id" text,
  "name" text,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "assigned_at" timestamp with time zone,
  "assigned_company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
  "assigned_user_id" uuid REFERENCES "portal_users"("id") ON DELETE SET NULL,
  "metadata_json" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_unassigned_portal_users_last_seen"
  ON "unassigned_portal_users" ("last_seen_at");
