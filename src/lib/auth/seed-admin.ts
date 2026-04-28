/**
 * Ensures the operator's profile row exists in `portal_users` so Clerk's
 * email-based lookup in `getPortalUser()` can resolve a `company_id`.
 *
 * This no longer stores or verifies a password — Clerk owns credentials.
 * The `hashed_pw` column is kept for backwards compatibility with older DB
 * rows and is populated with an empty string for new records.
 */

import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const OPERATOR_EMAIL = 'ethan.fleuryy@gmail.com';
const OPERATOR_NAME = 'Ethan Fleury';

export function seedAdminUser(db: Database.Database) {
  const existing = db
    .prepare(`SELECT id, company_id FROM portal_users WHERE email = ? COLLATE NOCASE LIMIT 1`)
    .get(OPERATOR_EMAIL) as { id: string; company_id: string | null } | undefined;

  if (existing) {
    if (!existing.company_id) {
      const company = db.prepare(`SELECT id FROM companies ORDER BY created_at ASC LIMIT 1`).get() as
        | { id: string }
        | undefined;
      if (company) {
        db.prepare(
          `UPDATE portal_users SET company_id = ?, role = 'super_admin', updated_at = datetime('now') WHERE id = ?`,
        ).run(company.id, existing.id);
      }
    } else {
      db.prepare(
        `UPDATE portal_users SET role = 'super_admin', updated_at = datetime('now') WHERE id = ? AND role NOT IN ('super_admin')`,
      ).run(existing.id);
    }
    return;
  }

  const company = db.prepare(`SELECT id FROM companies ORDER BY created_at ASC LIMIT 1`).get() as
    | { id: string }
    | undefined;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO portal_users (id, company_id, email, name, hashed_pw, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
  ).run(id, company?.id ?? null, OPERATOR_EMAIL, OPERATOR_NAME, '', 'super_admin');

  console.log('[auth] Seeded operator profile for', OPERATOR_EMAIL);
}
