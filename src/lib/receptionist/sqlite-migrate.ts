import type Database from 'better-sqlite3';

function tableColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Idempotent ALTERs for existing DBs created before Retell/Twilio columns.
 */
export function applyReceptionistMigrations(db: Database.Database) {
  const calls = tableColumns(db, 'receptionist_calls');
  if (!calls.has('twilio_call_sid')) {
    db.exec('ALTER TABLE receptionist_calls ADD COLUMN twilio_call_sid TEXT');
  }
  if (!calls.has('provider_agent_id')) {
    db.exec('ALTER TABLE receptionist_calls ADD COLUMN provider_agent_id TEXT');
  }
  if (!calls.has('provider_status')) {
    db.exec('ALTER TABLE receptionist_calls ADD COLUMN provider_status TEXT');
  }

  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_receptionist_calls_twilio_sid
     ON receptionist_calls(twilio_call_sid) WHERE twilio_call_sid IS NOT NULL`,
  );
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_receptionist_calls_provider_call_id
     ON receptionist_calls(provider_call_id) WHERE provider_call_id IS NOT NULL`,
  );

  const events = tableColumns(db, 'receptionist_events');
  if (!events.has('source')) {
    db.exec(`ALTER TABLE receptionist_events ADD COLUMN source TEXT NOT NULL DEFAULT 'system'`);
  }

  const settings = tableColumns(db, 'receptionist_settings');
  if (!settings.has('retell_agent_id')) {
    db.exec('ALTER TABLE receptionist_settings ADD COLUMN retell_agent_id TEXT');
  }

  if (!calls.has('receptionist_meta_json')) {
    db.exec('ALTER TABLE receptionist_calls ADD COLUMN receptionist_meta_json TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS receptionist_tool_invocations (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      call_id TEXT NOT NULL REFERENCES receptionist_calls(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      request_json TEXT,
      response_json TEXT,
      status TEXT NOT NULL DEFAULT 'ok',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_receptionist_tool_call ON receptionist_tool_invocations(call_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS receptionist_staff_tasks (
      id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
      call_id TEXT NOT NULL REFERENCES receptionist_calls(id) ON DELETE CASCADE,
      task_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      title TEXT NOT NULL,
      details_json TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      assigned_to_plumber_id TEXT REFERENCES plumbers(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_receptionist_staff_tasks_call ON receptionist_staff_tasks(call_id);
    CREATE INDEX IF NOT EXISTS idx_receptionist_staff_tasks_status ON receptionist_staff_tasks(status);
  `);
}
