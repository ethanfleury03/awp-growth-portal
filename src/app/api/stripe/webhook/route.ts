import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { sql } from '@/lib/db';
import { getStripe } from '@/lib/payments/stripe';
import {
  applyChargeRefund,
  fulfillCheckoutSession,
  markPaymentExpiredBySessionId,
  markPaymentFailedByPaymentIntent,
  recordStripeEventProcessed,
  recordWebhookFailure,
  upsertDispute,
} from '@/lib/payments/payment-service';
import { computeConnectStatus } from '@/lib/payments/connect';
import {
  markBillingSubscriptionPastDue,
  upsertBillingSubscriptionFromCheckout,
  upsertBillingSubscriptionFromSubscription,
} from '@/lib/marketing/subscriptions';

export async function POST(request: Request) {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (!stripe || !whSecret) {
    return NextResponse.json({ error: 'Stripe webhooks not configured' }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch {
    if (!connectSecret) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(body, sig, connectSecret);
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  const dupRows = await sql`SELECT 1 FROM payment_events WHERE stripe_event_id = ${event.id} LIMIT 1`;
  if (dupRows.length) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await fulfillCheckoutSession(session);
        await upsertBillingSubscriptionFromCheckout(session);
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaymentExpiredBySessionId(session.id);
        break;
      }
      case 'payment_intent.payment_failed': {
        await markPaymentFailedByPaymentIntent(event.data.object as Stripe.PaymentIntent);
        break;
      }
      case 'charge.refunded': {
        await applyChargeRefund(event.data.object as Stripe.Charge);
        break;
      }
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        await upsertDispute(event.data.object as Stripe.Dispute);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await upsertBillingSubscriptionFromSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.payment_failed': {
        await markBillingSubscriptionPastDue(event.data.object as Stripe.Invoice);
        break;
      }
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const status = computeConnectStatus(account);
        const onboardedAt = status === 'enabled' ? new Date().toISOString() : null;
        await sql`
          UPDATE companies
          SET
            stripe_connect_status = ${status},
            stripe_onboarding_completed_at = COALESCE(stripe_onboarding_completed_at, ${onboardedAt}),
            updated_at = datetime('now')
          WHERE stripe_account_id = ${account.id}
        `;
        break;
      }
      default:
        break;
    }
    await recordStripeEventProcessed(event.id, event.type, null, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Webhook handler failed';
    console.error('[stripe webhook]', e);
    try {
      await recordWebhookFailure({
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type,
        payload: event,
        error: msg,
      });
    } catch (dlqErr) {
      console.error('[stripe webhook dlq]', dlqErr);
    }
    // Return 500 so Stripe retries. Once retries are exhausted the DLQ row is
    // all we have; admins can inspect + replay via /settings/payments/webhooks.
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
