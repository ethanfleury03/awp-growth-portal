import type Database from 'better-sqlite3';

export function applyAiMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'Other',
      status TEXT NOT NULL DEFAULT 'Active',
      body TEXT,
      url TEXT,
      tags_json TEXT,
      source_metadata_json TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_items_company
      ON knowledge_items(company_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_items_type
      ON knowledge_items(company_id, item_type);

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'New conversation',
      selected_model TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      created_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ai_conversations_company
      ON ai_conversations(company_id);

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      estimated_cost_usd TEXT,
      context_snapshot_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
      ON ai_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_company
      ON ai_messages(company_id);

    CREATE TABLE IF NOT EXISTS ai_action_drafts (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      conversation_id TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE,
      message_id TEXT REFERENCES ai_messages(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL,
      title TEXT NOT NULL,
      payload_json TEXT,
      status TEXT NOT NULL DEFAULT 'Draft',
      related_record_type TEXT,
      related_record_id TEXT,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ai_action_drafts_company
      ON ai_action_drafts(company_id);
    CREATE INDEX IF NOT EXISTS idx_ai_action_drafts_conversation
      ON ai_action_drafts(conversation_id);
  `);
}
