import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { sql } from '@/lib/db';

/**
 * Clerk webhook: keeps `portal_users` in sync with Clerk-owned accounts so
 * `getPortalUser()` can look the row up by clerk_user_id or email.
 *
 * Configure in Clerk Dashboard -> Webhooks, subscribe to:
 *   - user.created
 *   - user.updated
 *   - user.deleted
 *
 * Expects `CLERK_WEBHOOK_SECRET` in env.
 */

type ClerkEmailAddress = { id: string; email_address: string };
type ClerkUserEventData = {
  id: string;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

type ClerkEvent =
  | { type: 'user.created'; data: ClerkUserEventData }
  | { type: 'user.updated'; data: ClerkUserEventData }
  | { type: 'user.deleted'; data: { id: string; deleted?: boolean } }
  | { type: string; data: unknown };

function primaryEmail(data: ClerkUserEventData): string | null {
  if (!data.email_addresses?.length) return null;
  const primary = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
  return (primary?.email_address || data.email_addresses[0]?.email_address || '').toLowerCase() || null;
}

function displayName(data: ClerkUserEventData): string {
  const full = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  return full || data.username || primaryEmail(data) || '';
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);
  let evt: ClerkEvent;
  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      const data = evt.data as ClerkUserEventData;
      const email = primaryEmail(data);
      if (!email) {
        return NextResponse.json({ ok: true, skipped: 'no_email' });
      }
      const name = displayName(data);

      const existing = await sql`
        SELECT id, company_id FROM portal_users
        WHERE clerk_user_id = ${data.id} OR lower(email) = ${email}
        ORDER BY (clerk_user_id = ${data.id}) DESC
        LIMIT 1
      `;

      if (existing.length === 0) {
        const firstCo = await sql`SELECT id FROM companies ORDER BY datetime(created_at) ASC LIMIT 1`;
        const companyId = String((firstCo[0] as Record<string, unknown>)?.id || '') || null;
        await sql`
          INSERT INTO portal_users (id, company_id, email, name, hashed_pw, role, is_active, clerk_user_id)
          VALUES (${crypto.randomUUID()}, ${companyId}, ${email}, ${name}, ${''}, ${'staff'}, 1, ${data.id})
        `;
      } else {
        const row = existing[0] as Record<string, unknown>;
        await sql`
          UPDATE portal_users
          SET clerk_user_id = ${data.id},
              email = ${email},
              name = ${name || null},
              updated_at = datetime('now')
          WHERE id = ${String(row.id)}
        `;
      }

      return NextResponse.json({ ok: true });
    }

    if (evt.type === 'user.deleted') {
      const data = evt.data as { id: string };
      await sql`
        UPDATE portal_users
        SET is_active = 0, updated_at = datetime('now')
        WHERE clerk_user_id = ${data.id}
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, ignored: evt.type });
  } catch (err) {
    console.error('[clerk-webhook]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}
