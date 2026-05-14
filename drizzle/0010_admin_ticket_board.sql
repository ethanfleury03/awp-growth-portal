CREATE TABLE IF NOT EXISTS "admin_ticket_buckets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#2f6b4f',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_admin_ticket_buckets_active"
  ON "admin_ticket_buckets" ("is_active", "sort_order");

CREATE TABLE IF NOT EXISTS "admin_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bucket_id" uuid NOT NULL REFERENCES "admin_ticket_buckets"("id") ON DELETE RESTRICT,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "growth_records"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "description" text,
  "priority" text NOT NULL DEFAULT 'normal',
  "requester_email" text,
  "source" text NOT NULL DEFAULT 'admin',
  "due_date" timestamp with time zone,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_admin_tickets_bucket_order"
  ON "admin_tickets" ("bucket_id", "sort_order", "updated_at");
CREATE INDEX IF NOT EXISTS "idx_admin_tickets_company"
  ON "admin_tickets" ("company_id", "updated_at");
CREATE INDEX IF NOT EXISTS "idx_admin_tickets_project"
  ON "admin_tickets" ("project_id");
