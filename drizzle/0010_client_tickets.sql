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
