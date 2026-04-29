import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';

export type ClerkEmailAddress = { id: string; email_address: string };
export type ClerkUserEventData = {
  id: string;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

export function primaryEmail(data: ClerkUserEventData): string | null {
  if (!data.email_addresses?.length) return null;
  const primary = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
  return (primary?.email_address || data.email_addresses[0]?.email_address || '').toLowerCase() || null;
}

export function displayName(data: ClerkUserEventData): string {
  const full = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  return full || data.username || primaryEmail(data) || '';
}

export async function syncClerkUser(data: ClerkUserEventData) {
  const email = primaryEmail(data);
  if (!email) return { ok: true, skipped: 'no_email' as const };
  const name = displayName(data);

  const existing = await sql`
    SELECT id, company_id FROM portal_users
    WHERE clerk_user_id = ${data.id} OR lower(email) = ${email}
    ORDER BY (clerk_user_id = ${data.id}) DESC
    LIMIT 1
  `;

  if (existing.length === 0) {
    const unassigned = await sql`
      SELECT email FROM unassigned_portal_users WHERE email = ${email} LIMIT 1
    `;
    if (unassigned[0]) {
      await sql`
        UPDATE unassigned_portal_users
        SET clerk_user_id = ${data.id}, name = ${name || null}, last_seen_at = datetime('now')
        WHERE email = ${email}
      `;
    } else {
      await sql`
        INSERT INTO unassigned_portal_users (email, clerk_user_id, name, metadata_json)
        VALUES (${email}, ${data.id}, ${name}, ${JSON.stringify({ source: 'clerk_webhook' })})
      `;
    }
    return { ok: true, unassigned: true as const, email };
  }

  const row = existing[0] as Record<string, unknown>;
  await sql`
    UPDATE portal_users
    SET clerk_user_id = ${data.id},
        email = ${email},
        name = ${name || null},
        updated_at = datetime('now')
    WHERE id = ${String(row.id)}
  `;
  return { ok: true, linked: true as const, email };
}

export async function markClerkUserDeleted(clerkUserId: string) {
  await sql`
    UPDATE portal_users
    SET is_active = 0, updated_at = datetime('now')
    WHERE clerk_user_id = ${clerkUserId}
  `;
}

export function makePortalUserId() {
  return randomUUID();
}
