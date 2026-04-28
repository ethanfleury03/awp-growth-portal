import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import {
  applyChargeRefund,
  fulfillCheckoutSession,
  markPaymentExpiredBySessionId,
  markPaymentFailedByPaymentIntent,
  upsertDispute,
} from '@/lib/payments/payment-service';
import { computeConnectStatus } from '@/lib/payments/connect';

/**
 * Replay a dead-lettered webhook. Re-runs the handler with the saved payload;
 * on success marks it resolved so it disappears from the DLQ.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const rows = await sql`SELECT * FROM webhook_failures WHERE id = ${id} LIMIT 1`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let event: Stripe.Event;
  try {
    event = JSON.parse(String(row.payload_json)) as Stripe.Event;
  } catch {
    return NextResponse.json({ error: 'Invalid stored payload' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await fulfillCheckoutSession(event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.expired':
        await markPaymentExpiredBySessionId((event.data.object as Stripe.Checkout.Session).id);
        break;
      case 'payment_intent.payment_failed':
        await markPaymentFailedByPaymentIntent(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await applyChargeRefund(event.data.object as Stripe.Charge);
        break;
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed':
        await upsertDispute(event.data.object as Stripe.Dispute);
        break;
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const status = computeConnectStatus(account);
        const onboardedAt = status === 'enabled' ? new Date().toISOString() : null;
        await sql`
          UPDATE companies
          SET stripe_connect_status = ${status},
              stripe_onboarding_completed_at = COALESCE(stripe_onboarding_completed_at, ${onboardedAt}),
              updated_at = datetime('now')
          WHERE stripe_account_id = ${account.id}
        `;
        break;
      }
      default:
        break;
    }

    await sql`
      UPDATE webhook_failures
      SET resolved_at = datetime('now'),
          attempt_count = attempt_count + 1,
          updated_at = datetime('now')
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Replay failed';
    await sql`
      UPDATE webhook_failures
      SET attempt_count = attempt_count + 1,
          error_message = ${msg},
          updated_at = datetime('now')
      WHERE id = ${id}
    `;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
