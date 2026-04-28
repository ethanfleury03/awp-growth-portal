import { randomUUID } from 'crypto';
import type Stripe from 'stripe';
import { sql } from '@/lib/db';
import { getStripe } from '@/lib/payments/stripe';
import { paymentsAppBaseUrl } from '@/lib/payments/urls';
import {
  applicationFeeCents,
  getConnectedAccountForCharge,
} from '@/lib/payments/connect';

/** Inserted before creating a Checkout Session so metadata can reference a stable id. */
export async function insertPendingPayment(input: {
  companyId: string;
  sourceType: 'estimate_deposit' | 'invoice_payment';
  sourceId: string;
  amountCents: number;
  currency?: string;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
}): Promise<string> {
  const id = randomUUID();
  const metaJson = input.metadata ? JSON.stringify(input.metadata) : null;
  await sql`
    INSERT INTO payments (
      id, company_id, source_type, source_id, amount_cents, currency, status, customer_email, metadata_json
    ) VALUES (
      ${id},
      ${input.companyId},
      ${input.sourceType},
      ${input.sourceId},
      ${input.amountCents},
      ${(input.currency || 'usd').toLowerCase()},
      'pending',
      ${input.customerEmail ?? null},
      ${metaJson}
    )
  `;
  return id;
}

export async function attachCheckoutSessionToPayment(
  paymentId: string,
  sessionId: string,
  url: string | null,
): Promise<void> {
  await sql`
    UPDATE payments SET
      stripe_checkout_session_id = ${sessionId},
      payment_url = ${url},
      updated_at = datetime('now')
    WHERE id = ${paymentId}
  `;
}

/**
 * Build the common Connect-aware Checkout Session input. Uses a **destination
 * charge** with `transfer_data.destination = connectedAccountId` so funds land
 * on the platform first (retaining data + dispute tooling) then settle to the
 * connected account, minus the application fee.
 */
async function buildConnectCheckoutInput(args: {
  paymentId: string;
  companyId: string;
  sourceType: 'estimate_deposit' | 'invoice_payment';
  sourceId: string;
  amountCents: number;
  lineName: string;
  lineDescription: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
}): Promise<
  | { session: Stripe.Checkout.SessionCreateParams; stripeAccountId: string; feeCents: number }
  | { error: string }
> {
  const stripeAccountId = await getConnectedAccountForCharge(args.companyId);
  if (!stripeAccountId) {
    return {
      error:
        'This company has not finished Stripe payments setup. Please complete onboarding in Settings → Payments before accepting charges.',
    };
  }
  const feeCents = applicationFeeCents(args.amountCents);

  const session: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    customer_email: args.customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: args.amountCents,
          product_data: { name: args.lineName, description: args.lineDescription },
        },
        quantity: 1,
      },
    ],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    payment_intent_data: {
      application_fee_amount: feeCents,
      transfer_data: { destination: stripeAccountId },
      metadata: {
        payment_id: args.paymentId,
        company_id: args.companyId,
        source_type: args.sourceType,
        source_id: args.sourceId,
      },
    },
    metadata: {
      payment_id: args.paymentId,
      company_id: args.companyId,
      source_type: args.sourceType,
      source_id: args.sourceId,
    },
  };

  return { session, stripeAccountId, feeCents };
}

export async function createEstimateDepositCheckoutSession(input: {
  estimateId: string;
  estimateNumber: string;
  companyId: string;
  token: string;
  amountCents: number;
  customerEmail?: string | null;
}): Promise<{ url: string; paymentId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured (missing STRIPE_SECRET_KEY).' };

  const base = paymentsAppBaseUrl();
  const paymentId = await insertPendingPayment({
    companyId: input.companyId,
    sourceType: 'estimate_deposit',
    sourceId: input.estimateId,
    amountCents: input.amountCents,
    customerEmail: input.customerEmail,
    metadata: { estimate_number: input.estimateNumber },
  });

  const built = await buildConnectCheckoutInput({
    paymentId,
    companyId: input.companyId,
    sourceType: 'estimate_deposit',
    sourceId: input.estimateId,
    amountCents: input.amountCents,
    lineName: `Deposit — Estimate ${input.estimateNumber}`,
    lineDescription: 'Estimate deposit (applied to your project)',
    successUrl: `${base}/estimate/${input.token}/deposit/return?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/estimate/${input.token}?deposit=cancelled`,
    customerEmail: input.customerEmail,
  });
  if ('error' in built) {
    await sql`UPDATE payments SET status = 'failed', failed_at = datetime('now'), updated_at = datetime('now') WHERE id = ${paymentId}`;
    return { error: built.error };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(built.session);
  } catch (e) {
    await sql`UPDATE payments SET status = 'failed', failed_at = datetime('now'), updated_at = datetime('now') WHERE id = ${paymentId}`;
    return { error: e instanceof Error ? e.message : 'Stripe error' };
  }

  await attachCheckoutSessionToPayment(paymentId, session.id, session.url);
  await sql`
    UPDATE payments
    SET stripe_account_id = ${built.stripeAccountId},
        application_fee_cents = ${built.feeCents},
        updated_at = datetime('now')
    WHERE id = ${paymentId}
  `;
  await sql`UPDATE estimates SET deposit_status = 'pending', updated_at = datetime('now') WHERE id = ${input.estimateId}`;
  if (!session.url) return { error: 'Stripe did not return a checkout URL.' };
  return { url: session.url, paymentId };
}

export async function createInvoicePaymentCheckoutSession(input: {
  invoiceId: string;
  invoiceNumber: string;
  companyId: string;
  publicPayToken: string;
  amountCents: number;
  customerEmail?: string | null;
}): Promise<{ url: string; paymentId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured (missing STRIPE_SECRET_KEY).' };

  const base = paymentsAppBaseUrl();
  const paymentId = await insertPendingPayment({
    companyId: input.companyId,
    sourceType: 'invoice_payment',
    sourceId: input.invoiceId,
    amountCents: input.amountCents,
    customerEmail: input.customerEmail,
    metadata: { invoice_number: input.invoiceNumber },
  });

  const built = await buildConnectCheckoutInput({
    paymentId,
    companyId: input.companyId,
    sourceType: 'invoice_payment',
    sourceId: input.invoiceId,
    amountCents: input.amountCents,
    lineName: `Invoice ${input.invoiceNumber}`,
    lineDescription: 'Payment due',
    successUrl: `${base}/pay/invoice/${input.publicPayToken}/return?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/pay/invoice/${input.publicPayToken}?cancelled=1`,
    customerEmail: input.customerEmail,
  });
  if ('error' in built) {
    await sql`UPDATE payments SET status = 'failed', failed_at = datetime('now'), updated_at = datetime('now') WHERE id = ${paymentId}`;
    return { error: built.error };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(built.session);
  } catch (e) {
    await sql`UPDATE payments SET status = 'failed', failed_at = datetime('now'), updated_at = datetime('now') WHERE id = ${paymentId}`;
    return { error: e instanceof Error ? e.message : 'Stripe error' };
  }

  await attachCheckoutSessionToPayment(paymentId, session.id, session.url);
  await sql`
    UPDATE payments
    SET stripe_account_id = ${built.stripeAccountId},
        application_fee_cents = ${built.feeCents},
        updated_at = datetime('now')
    WHERE id = ${paymentId}
  `;
  if (!session.url) return { error: 'Stripe did not return a checkout URL.' };
  return { url: session.url, paymentId };
}

async function logEstimateActivity(
  estimateId: string,
  eventType: string,
  payload: Record<string, unknown>,
  actorType: string,
) {
  const aid = randomUUID();
  await sql`
    INSERT INTO estimate_activity (id, estimate_id, event_type, payload_json, actor_type, actor_id)
    VALUES (
      ${aid},
      ${estimateId},
      ${eventType},
      ${JSON.stringify(payload)},
      ${actorType},
      NULL
    )
  `;
}

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  const sessionId = session.id;
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const rows = await sql`
    SELECT * FROM payments WHERE stripe_checkout_session_id = ${sessionId} LIMIT 1
  `;
  if (!rows.length) return;
  const pay = rows[0] as Record<string, unknown>;
  if (pay.status === 'paid') return;

  await sql`
    UPDATE payments SET
      status = 'paid',
      paid_at = datetime('now'),
      stripe_payment_intent_id = ${paymentIntentId},
      updated_at = datetime('now')
    WHERE id = ${pay.id as string}
  `;

  const sourceType = String(pay.source_type);
  const sourceId = String(pay.source_id);

  if (sourceType === 'estimate_deposit') {
    const estRows = await sql`SELECT status FROM estimates WHERE id = ${sourceId} LIMIT 1`;
    const st = String((estRows[0] as { status?: string } | undefined)?.status || '');
    if (st === 'rejected' || st === 'expired' || st === 'converted') {
      return;
    }
    await sql`
      UPDATE estimates SET
        deposit_status = 'paid',
        deposit_paid_at = datetime('now'),
        status = 'approved',
        approved_at = COALESCE(approved_at, datetime('now')),
        updated_at = datetime('now')
      WHERE id = ${sourceId}
    `;
    await logEstimateActivity(sourceId, 'deposit_paid', { payment_id: pay.id, session_id: sessionId }, 'customer');
    await logEstimateActivity(sourceId, 'approved', { via: 'deposit_checkout' }, 'customer');
    return;
  }

  if (sourceType === 'invoice_payment') {
    const inv = await sql`SELECT status FROM invoices WHERE id = ${sourceId} LIMIT 1`;
    if ((inv[0] as { status?: string } | undefined)?.status === 'paid') return;
    const today = new Date().toISOString().split('T')[0];
    await sql`
      UPDATE invoices SET
        status = 'paid',
        paid_date = ${today},
        updated_at = datetime('now')
      WHERE id = ${sourceId}
    `;
  }
}

export async function markPaymentFailedBySessionId(sessionId: string): Promise<void> {
  await sql`
    UPDATE payments SET status = 'failed', failed_at = datetime('now'), updated_at = datetime('now')
    WHERE stripe_checkout_session_id = ${sessionId} AND status = 'pending'
  `;
}

export async function markPaymentExpiredBySessionId(sessionId: string): Promise<void> {
  await sql`
    UPDATE payments SET status = 'expired', updated_at = datetime('now')
    WHERE stripe_checkout_session_id = ${sessionId} AND status = 'pending'
  `;
}

export async function recordStripeEventProcessed(
  stripeEventId: string,
  eventType: string,
  paymentId: string | null,
  payload: unknown,
): Promise<boolean> {
  const existing = await sql`SELECT 1 FROM payment_events WHERE stripe_event_id = ${stripeEventId} LIMIT 1`;
  if (existing.length) return false;
  const id = randomUUID();
  await sql`
    INSERT INTO payment_events (id, stripe_event_id, event_type, payment_id, payload_json)
    VALUES (
      ${id},
      ${stripeEventId},
      ${eventType},
      ${paymentId},
      ${JSON.stringify(payload)}
    )
  `;
  return true;
}

/** Handle `charge.refunded`: update payment.refunded_amount_cents + invoice status. */
export async function applyChargeRefund(charge: Stripe.Charge): Promise<void> {
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  const rows = await sql`SELECT * FROM payments WHERE stripe_payment_intent_id = ${piId} LIMIT 1`;
  if (!rows.length) return;
  const pay = rows[0] as Record<string, unknown>;
  const refundedCents = charge.amount_refunded ?? 0;
  const amountCents = Number(pay.amount_cents) || 0;
  const fullyRefunded = refundedCents >= amountCents;

  await sql`
    UPDATE payments
    SET refunded_amount_cents = ${refundedCents},
        refunded_at = ${fullyRefunded ? new Date().toISOString() : null},
        status = ${fullyRefunded ? 'refunded' : 'partial_refund'},
        updated_at = datetime('now')
    WHERE id = ${pay.id as string}
  `;

  if (fullyRefunded && String(pay.source_type) === 'invoice_payment') {
    await sql`
      UPDATE invoices
      SET status = 'refunded', updated_at = datetime('now')
      WHERE id = ${String(pay.source_id)}
    `;
  }
}

/**
 * Manual refund from staff UI. Issues a Stripe refund on the connected account
 * that owns the charge. Webhook (`charge.refunded`) finalizes state.
 */
export async function refundPayment(args: {
  paymentId: string;
  companyId: string;
  amountCents?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}): Promise<{ refundId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe not configured' };

  const rows = await sql`
    SELECT * FROM payments
    WHERE id = ${args.paymentId} AND company_id = ${args.companyId}
    LIMIT 1
  `;
  if (!rows.length) return { error: 'Payment not found' };
  const pay = rows[0] as Record<string, unknown>;
  const piId = pay.stripe_payment_intent_id as string | null;
  if (!piId) return { error: 'Payment has no PaymentIntent yet; cannot refund.' };
  const status = String(pay.status);
  if (!['paid', 'partial_refund'].includes(status)) {
    return { error: `Cannot refund a payment in status "${status}"` };
  }
  const alreadyRefunded = Number(pay.refunded_amount_cents) || 0;
  const remaining = Number(pay.amount_cents) - alreadyRefunded;
  if (remaining <= 0) return { error: 'Nothing left to refund' };
  const refundAmount = args.amountCents ?? remaining;
  if (refundAmount > remaining) return { error: 'Refund exceeds remaining amount' };

  const stripeAccountId = (pay.stripe_account_id as string | null) || undefined;
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: piId,
        amount: refundAmount,
        reason: args.reason,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      stripeAccountId ? { stripeAccount: stripeAccountId } : undefined,
    );
    return { refundId: refund.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Stripe refund failed' };
  }
}

/** Handle `charge.dispute.*` events. Persists to `disputes` table. */
export async function upsertDispute(dispute: Stripe.Dispute): Promise<void> {
  const piId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
  const payRows = piId
    ? await sql`SELECT id, company_id FROM payments WHERE stripe_payment_intent_id = ${piId} LIMIT 1`
    : [];
  const pay = payRows[0] as Record<string, unknown> | undefined;
  if (!pay) return;

  const evidenceDueBy = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
    : null;

  const existing = await sql`SELECT id FROM disputes WHERE stripe_dispute_id = ${dispute.id} LIMIT 1`;
  if (existing.length) {
    await sql`
      UPDATE disputes
      SET status = ${dispute.status},
          amount_cents = ${dispute.amount},
          evidence_due_by = ${evidenceDueBy},
          updated_at = datetime('now')
      WHERE stripe_dispute_id = ${dispute.id}
    `;
    return;
  }
  const id = randomUUID();
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null;
  await sql`
    INSERT INTO disputes (
      id, company_id, payment_id, stripe_dispute_id, stripe_charge_id,
      amount_cents, currency, reason, status, evidence_due_by
    ) VALUES (
      ${id},
      ${String(pay.company_id)},
      ${String(pay.id)},
      ${dispute.id},
      ${chargeId},
      ${dispute.amount},
      ${dispute.currency},
      ${dispute.reason},
      ${dispute.status},
      ${evidenceDueBy}
    )
  `;
}

export async function markPaymentFailedByPaymentIntent(pi: Stripe.PaymentIntent): Promise<void> {
  await sql`
    UPDATE payments
    SET status = 'failed',
        failed_at = datetime('now'),
        updated_at = datetime('now')
    WHERE stripe_payment_intent_id = ${pi.id} AND status IN ('pending','requires_action')
  `;
}

/** Persist a webhook processing failure for the DLQ UI. */
export async function recordWebhookFailure(args: {
  provider: string;
  eventId: string | null;
  eventType: string | null;
  payload: unknown;
  error: string;
  companyId?: string | null;
}): Promise<void> {
  const id = randomUUID();
  await sql`
    INSERT INTO webhook_failures (
      id, company_id, provider, event_id, event_type, payload_json, error_message
    ) VALUES (
      ${id},
      ${args.companyId ?? null},
      ${args.provider},
      ${args.eventId},
      ${args.eventType},
      ${JSON.stringify(args.payload)},
      ${args.error}
    )
  `;
}
