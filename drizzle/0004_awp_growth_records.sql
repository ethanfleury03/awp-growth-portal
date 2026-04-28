ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lead_context_json" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_follow_up_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_contacted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "estimated_value_cents" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "record_type" text NOT NULL,
  "source_key" text,
  "title" text NOT NULL,
  "status" text DEFAULT 'Idea' NOT NULL,
  "owner" text,
  "related_record_id" uuid,
  "payload_json" text,
  "is_demo" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "growth_records" DROP CONSTRAINT IF EXISTS "growth_records_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "growth_records" ADD CONSTRAINT "growth_records_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_growth_records_company_type"
  ON "growth_records" USING btree ("company_id","record_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_growth_records_source_key"
  ON "growth_records" USING btree ("company_id","record_type","source_key")
  WHERE "source_key" IS NOT NULL;
