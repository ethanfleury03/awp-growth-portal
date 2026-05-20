ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "solution_summary" text;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "solution_details" text;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "solution_source" text;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "solution_external_id" text;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "solution_reported_at" timestamp with time zone;
