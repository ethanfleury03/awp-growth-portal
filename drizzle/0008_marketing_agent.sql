ALTER TABLE "ai_conversations"
  ADD COLUMN IF NOT EXISTS "conversation_type" text NOT NULL DEFAULT 'assistant';

CREATE INDEX IF NOT EXISTS "idx_ai_conversations_company_type"
  ON "ai_conversations" USING btree ("company_id", "conversation_type", "updated_at");

CREATE TABLE IF NOT EXISTS "marketing_agent_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "memory_type" text NOT NULL DEFAULT 'Strategy',
  "title" text NOT NULL,
  "body" text NOT NULL,
  "confidence" text NOT NULL DEFAULT 'Working',
  "source" text NOT NULL DEFAULT 'Marketing Agent',
  "status" text NOT NULL DEFAULT 'Active',
  "metadata_json" text,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_marketing_agent_memories_company"
  ON "marketing_agent_memories" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "idx_marketing_agent_memories_type"
  ON "marketing_agent_memories" USING btree ("company_id", "memory_type");
CREATE INDEX IF NOT EXISTS "idx_marketing_agent_memories_status"
  ON "marketing_agent_memories" USING btree ("company_id", "status");

CREATE TABLE IF NOT EXISTS "marketing_agent_tool_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "conversation_id" uuid REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "message_id" uuid REFERENCES "ai_messages"("id") ON DELETE SET NULL,
  "tool_name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'succeeded',
  "reason" text,
  "input_json" text,
  "output_json" text,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_marketing_agent_tool_events_company"
  ON "marketing_agent_tool_events" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "idx_marketing_agent_tool_events_conversation"
  ON "marketing_agent_tool_events" USING btree ("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_marketing_agent_tool_events_tool"
  ON "marketing_agent_tool_events" USING btree ("company_id", "tool_name");
