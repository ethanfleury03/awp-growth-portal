ALTER TABLE "feature_flags" ADD COLUMN IF NOT EXISTS "flag_key" text;
--> statement-breakpoint
ALTER TABLE "feature_flags" ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "feature_flags" ADD COLUMN IF NOT EXISTS "payload_json" text;
--> statement-breakpoint
UPDATE "feature_flags"
SET
  "flag_key" = COALESCE("flag_key", "key"),
  "enabled" = CASE
    WHEN lower(COALESCE("value", 'false')) IN ('true', '1', 'yes', 'on') THEN true
    ELSE COALESCE("enabled", false)
  END
WHERE "flag_key" IS NULL;
--> statement-breakpoint
ALTER TABLE "feature_flags" ALTER COLUMN "flag_key" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_feature_flags_company_key";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_feature_flags_company_key"
  ON "feature_flags" ("company_id", "flag_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_settings" (
  "company_id" uuid PRIMARY KEY REFERENCES "companies"("id") ON DELETE cascade,
  "display_name" text NOT NULL,
  "legal_name" text,
  "industry" text NOT NULL DEFAULT 'generic',
  "timezone" text NOT NULL DEFAULT 'America/New_York',
  "logo_url" text,
  "primary_color" text NOT NULL DEFAULT '#f26a1f',
  "accent_color" text NOT NULL DEFAULT '#2563eb',
  "portal_title" text NOT NULL DEFAULT 'WNY Automation Portal',
  "workspace_label" text NOT NULL DEFAULT 'Automation workspace',
  "default_route" text NOT NULL DEFAULT '/app',
  "config_json" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "company_settings" ("company_id", "display_name", "legal_name")
SELECT "id", "name", "name"
FROM "companies"
ON CONFLICT ("company_id") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_custom_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "entity_type" text NOT NULL,
  "field_key" text NOT NULL,
  "label" text NOT NULL,
  "field_type" text NOT NULL DEFAULT 'text',
  "required" boolean NOT NULL DEFAULT false,
  "options_json" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_company_custom_fields_company_entity"
  ON "company_custom_fields" ("company_id", "entity_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_company_custom_fields_unique"
  ON "company_custom_fields" ("company_id", "entity_type", "field_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_pipeline_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "entity_type" text NOT NULL,
  "stage_key" text NOT NULL,
  "label" text NOT NULL,
  "color" text NOT NULL DEFAULT '#2563eb',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_company_pipeline_stages_company_entity"
  ON "company_pipeline_stages" ("company_id", "entity_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_company_pipeline_stages_unique"
  ON "company_pipeline_stages" ("company_id", "entity_type", "stage_key");
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_email" text;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_role" text;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "summary" text;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "metadata" text;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_agent" text;
