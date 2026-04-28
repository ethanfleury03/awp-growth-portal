import { getDb } from '@/lib/db';

/** Thread-safe enough for single-writer SQLite (Next.js server). */
export function allocateEstimateNumber(): string {
  const db = getDb();
  return db.transaction(() => {
    const row = db
      .prepare(`SELECT estimate_prefix, next_sequence FROM estimate_settings WHERE id = 'default'`)
      .get() as { estimate_prefix: string; next_sequence: number } | undefined;
    const prefix = (row?.estimate_prefix || 'EST').replace(/[^A-Za-z0-9_-]/g, '') || 'EST';
    const seq = row?.next_sequence ?? 1000;
    db.prepare(`UPDATE estimate_settings SET next_sequence = next_sequence + 1, updated_at = datetime('now') WHERE id = 'default'`).run();
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
  })();
}
