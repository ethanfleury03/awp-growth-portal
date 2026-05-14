import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { withSuperAdminContext } from '@/lib/db';
import { markClerkUserDeleted, syncClerkUser, type ClerkUserEventData } from '@/lib/auth/clerk-sync';

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

type ClerkEvent =
  | { type: 'user.created'; data: ClerkUserEventData }
  | { type: 'user.updated'; data: ClerkUserEventData }
  | { type: 'user.deleted'; data: { id: string; deleted?: boolean } }
  | { type: string; data: unknown };

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET || process.env.CLERK_WEBHOOK_SIGNING_SECRET;
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

  return withSuperAdminContext(async () => {
  try {
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      return NextResponse.json(await syncClerkUser(evt.data as ClerkUserEventData));
    }

    if (evt.type === 'user.deleted') {
      const data = evt.data as { id: string };
      await markClerkUserDeleted(data.id);
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
  });
}
