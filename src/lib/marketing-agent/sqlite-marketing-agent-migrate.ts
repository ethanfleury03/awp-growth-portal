import type Database from 'better-sqlite3';

function columnExists(db: Database.Database, table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

export function applyMarketingAgentMigrations(db: Database.Database) {
  if (!columnExists(db, 'ai_conversations', 'conversation_type')) {
    db.exec(`
      ALTER TABLE ai_conversations
      ADD COLUMN conversation_type TEXT NOT NULL DEFAULT 'assistant'
    `);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_company_type
      ON ai_conversations(company_id, conversation_type, updated_at);

    CREATE TABLE IF NOT EXISTS marketing_agent_memories (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      memory_type TEXT NOT NULL DEFAULT 'Strategy',
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'Working',
      source TEXT NOT NULL DEFAULT 'Marketing Agent',
      status TEXT NOT NULL DEFAULT 'Active',
      metadata_json TEXT,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_marketing_agent_memories_company
      ON marketing_agent_memories(company_id);
    CREATE INDEX IF NOT EXISTS idx_marketing_agent_memories_type
      ON marketing_agent_memories(company_id, memory_type);
    CREATE INDEX IF NOT EXISTS idx_marketing_agent_memories_status
      ON marketing_agent_memories(company_id, status);

    CREATE TABLE IF NOT EXISTS marketing_agent_tool_events (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      conversation_id TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE,
      message_id TEXT REFERENCES ai_messages(id) ON DELETE SET NULL,
      tool_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'succeeded',
      reason TEXT,
      input_json TEXT,
      output_json TEXT,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_marketing_agent_tool_events_company
      ON marketing_agent_tool_events(company_id);
    CREATE INDEX IF NOT EXISTS idx_marketing_agent_tool_events_conversation
      ON marketing_agent_tool_events(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_marketing_agent_tool_events_tool
      ON marketing_agent_tool_events(company_id, tool_name);
  `);
}
