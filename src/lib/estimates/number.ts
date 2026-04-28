import type Database from 'better-sqlite3';

/**
 * Allocates next per-company, per-year sequence and returns full estimate_number.
 * Uses IMMEDIATE transaction for SQLite concurrency safety.
 */
export function allocateEstimateNumber(
  db: Database.Database,
  companyId: string,
  prefix: string,
): string {
  const year = new Date().getFullYear();
  const safePrefix = (prefix || 'EST').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || 'EST';

  const tx = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT last_seq FROM estimate_number_sequences WHERE company_id = ? AND year = ?`,
      )
      .get(companyId, year) as { last_seq: number } | undefined;

    let next = 1;
    if (row) {
      next = Number(row.last_seq) + 1;
      db.prepare(
        `UPDATE estimate_number_sequences SET last_seq = ? WHERE company_id = ? AND year = ?`,
      ).run(next, companyId, year);
    } else {
      db.prepare(
        `INSERT INTO estimate_number_sequences (company_id, year, last_seq) VALUES (?, ?, 1)`,
      ).run(companyId, year);
    }

    return `${safePrefix}-${year}-${String(next).padStart(4, '0')}`;
  });

  return tx();
}
