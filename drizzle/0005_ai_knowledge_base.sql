CREATE TABLE IF NOT EXISTS "knowledge_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "item_type" text NOT NULL DEFAULT 'Other',
  "status" text NOT NULL DEFAULT 'Active',
  "body" text,
  "url" text,
  "tags_json" text,
  "source_metadata_json" text,
  "is_pinned" boolean NOT NULL DEFAULT false,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_knowledge_items_company" ON "knowledge_items" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_knowledge_items_type" ON "knowledge_items" ("company_id", "item_type");

CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "title" text NOT NULL DEFAULT 'New conversation',
  "selected_model" text,
  "status" text NOT NULL DEFAULT 'Active',
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ai_conversations_company" ON "ai_conversations" ("company_id");

CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "conversation_id" uuid NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "model" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "estimated_cost_usd" text,
  "context_snapshot_json" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ai_messages_conversation" ON "ai_messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_ai_messages_company" ON "ai_messages" ("company_id");

CREATE TABLE IF NOT EXISTS "ai_action_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "conversation_id" uuid REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "message_id" uuid REFERENCES "ai_messages"("id") ON DELETE CASCADE,
  "action_type" text NOT NULL,
  "title" text NOT NULL,
  "payload_json" text,
  "status" text NOT NULL DEFAULT 'Draft',
  "related_record_type" text,
  "related_record_id" uuid,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ai_action_drafts_company" ON "ai_action_drafts" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_ai_action_drafts_conversation" ON "ai_action_drafts" ("conversation_id");
