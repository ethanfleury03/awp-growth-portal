import { randomUUID } from 'crypto';
import type Stripe from 'stripe';
import { sql } from '@/lib/db';
import { getStripe } from '@/lib/payments/stripe';
import {
  AI_OVERAGE_MULTIPLIER,
  aggregateAiUsageRows,
  calculateAiOverageCents,
  formatCurrencyFromCents,
  sqlDateTime,
  startOfCurrentMonth,
  startOfNextMonth,
  subtractOneMonth,
  type AiUsageRow,
  type BillingAiUsageSummary,
} from '@/lib/billing/usage';

export const CRM_BILLING_PLAN = {
  key: 'awp_crm',
  name: 'WNY Automation Portal CRM',
  amountCents: 10000,
  currency: 'usd',
  interval: 'month',
};

type BillingSubscriptionRow = {
  id: string;
  company_id: string | null;
  clerk_user_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  stripe_checkout_session_id: string | null;
  price_id: string | null;
  plan: string;
  status: string;
  billing_cycle: string;
  trial_ends_at: string | Date | null;
  current_period_start?: string | Date | null;
  current_period_end: string | Date | null;
  metadata_json: string | null;
  updated_at: string | Date | null;
};

export type BillingSubscriptionSummary = {
  id: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  stripeCheckoutSessionId: string | null;
  priceId: string | null;
  plan: string;
  status: string;
  billingCycle: string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  updatedAt: string | null;
};

export type BillingInvoiceSummary = {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  amountDueCents: number;
  amountPaidCents: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  createdAt: string | null;
  lines: { description: string; amountCents: number }[];
};

export type BillingUsagePeriodSummary = {
  id: string;
  periodStart: string;
  periodEnd: string;
  providerCostUsd: number;
  overageAmountCents: number;
  overageLabel: string;
  status: string;
  stripeInvoiceId: string | null;
  stripeInvoiceItemId: string | null;
};

export function billingAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    'http://localhost:3003'
  );
}

export function resolveCrmBillingPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_AWP_CRM_MONTHLY?.trim() || undefined;
}

function numberFrom(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function dateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const raw = String(value);
  const parsed = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSubscription(row: BillingSubscriptionRow): BillingSubscriptionSummary {
  return {
    id: String(row.id),
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionId: String(row.stripe_subscription_id),
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    priceId: row.price_id || null,
    plan: String(row.plan || CRM_BILLING_PLAN.key),
    status: String(row.status || 'incomplete'),
    billingCycle: String(row.billing_cycle || 'monthly'),
    trialEndsAt: isoOrNull(row.trial_ends_at),
    currentPeriodStart: isoOrNull(row.current_period_start || null),
    currentPeriodEnd: isoOrNull(row.current_period_end),
    updatedAt: isoOrNull(row.updated_at),
  };
}

export async function getCurrentBillingSubscription(companyId: string): Promise<BillingSubscriptionSummary | null> {
  const priceId = resolveCrmBillingPriceId();
  const rows = priceId
    ? await sql`
        SELECT id, company_id, clerk_user_id, stripe_customer_id, stripe_subscription_id,
               stripe_checkout_session_id, price_id, plan, status, billing_cycle,
               trial_ends_at, current_period_start, current_period_end, metadata_json, updated_at
        FROM billing_subscriptions
        WHERE company_id = ${companyId}
          AND (plan = ${CRM_BILLING_PLAN.key} OR price_id = ${priceId})
        ORDER BY updated_at DESC
        LIMIT 1
      `
    : await sql`
        SELECT id, company_id, clerk_user_id, stripe_customer_id, stripe_subscription_id,
               stripe_checkout_session_id, price_id, plan, status, billing_cycle,
               trial_ends_at, current_period_start, current_period_end, metadata_json, updated_at
        FROM billing_subscriptions
        WHERE company_id = ${companyId}
          AND plan = ${CRM_BILLING_PLAN.key}
        ORDER BY updated_at DESC
        LIMIT 1
      `;
  const row = rows[0] as BillingSubscriptionRow | undefined;
  return row ? normalizeSubscription(row) : null;
}

export function billingPeriodForSubscription(
  subscription: BillingSubscriptionSummary | null,
  now = new Date(),
): { start: Date; end: Date } {
  const end = dateOrNull(subscription?.currentPeriodEnd);
  const start = dateOrNull(subscription?.currentPeriodStart);
  if (start && end && end > start) return { start, end };
  if (end) return { start: subtractOneMonth(end), end };
  return { start: startOfCurrentMonth(now), end: startOfNextMonth(now) };
}

export async function getAiUsageForPeriod(
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ usage: BillingAiUsageSummary; recentMessages: Record<string, unknown>[] }> {
  const rows = await sql`
    SELECT id, model, input_tokens, output_tokens, estimated_cost_usd, created_at, content
    FROM ai_messages
    WHERE company_id = ${companyId}
      AND role = 'assistant'
      AND created_at >= ${sqlDateTime(periodStart)}
      AND created_at < ${sqlDateTime(periodEnd)}
    ORDER BY created_at DESC
    LIMIT 5000
  `;
  return {
    usage: aggregateAiUsageRows(rows as AiUsageRow[]),
    recentMessages: rows.slice(0, 20),
  };
}

async function listStripeInvoices(customerId: string | null): Promise<BillingInvoiceSummary[]> {
  const stripe = getStripe();
  if (!stripe || !customerId) return [];
  const invoices = await stripe.invoices.list({ customer: customerId, limit: 10 });
  return invoices.data.map((invoice) => {
    const raw = invoice as unknown as {
      id: string;
      number?: string | null;
      status?: string | null;
      currency?: string | null;
      amount_due?: number | null;
      amount_paid?: number | null;
      hosted_invoice_url?: string | null;
      invoice_pdf?: string | null;
      created?: number | null;
      lines?: { data?: { description?: string | null; amount?: number | null }[] };
    };
    return {
      id: raw.id,
      number: raw.number || null,
      status: raw.status || 'unknown',
      currency: raw.currency || 'usd',
      amountDueCents: raw.amount_due || 0,
      amountPaidCents: raw.amount_paid || 0,
      hostedInvoiceUrl: raw.hosted_invoice_url || null,
      invoicePdf: raw.invoice_pdf || null,
      createdAt: raw.created ? new Date(raw.created * 1000).toISOString() : null,
      lines: (raw.lines?.data || []).slice(0, 5).map((line) => ({
        description: line.description || 'Invoice item',
        amountCents: line.amount || 0,
      })),
    };
  });
}

async function getUsagePeriods(companyId: string): Promise<BillingUsagePeriodSummary[]> {
  const rows = await sql`
    SELECT id, period_start, period_end, provider_cost_usd, charge_amount_cents,
           status, stripe_invoice_id, stripe_invoice_item_id
    FROM billing_usage_periods
    WHERE company_id = ${companyId}
    ORDER BY period_start DESC
    LIMIT 12
  `;
  return rows.map((row) => ({
    id: String(row.id),
    periodStart: isoOrNull(row.period_start) || String(row.period_start || ''),
    periodEnd: isoOrNull(row.period_end) || String(row.period_end || ''),
    providerCostUsd: numberFrom(row.provider_cost_usd),
    overageAmountCents: numberFrom(row.charge_amount_cents),
    overageLabel: formatCurrencyFromCents(row.charge_amount_cents),
    status: String(row.status || 'pending'),
    stripeInvoiceId: row.stripe_invoice_id ? String(row.stripe_invoice_id) : null,
    stripeInvoiceItemId: row.stripe_invoice_item_id ? String(row.stripe_invoice_item_id) : null,
  }));
}

export async function getBillingSummary(companyId: string) {
  const subscription = await getCurrentBillingSubscription(companyId);
  const { start, end } = billingPeriodForSubscription(subscription);
  const [{ usage, recentMessages }, usagePeriods, invoices] = await Promise.all([
    getAiUsageForPeriod(companyId, start, end),
    getUsagePeriods(companyId),
    listStripeInvoices(subscription?.stripeCustomerId || null),
  ]);
  const priceId = resolveCrmBillingPriceId();

  return {
    plan: {
      key: CRM_BILLING_PLAN.key,
      name: CRM_BILLING_PLAN.name,
      amountCents: CRM_BILLING_PLAN.amountCents,
      amountLabel: formatCurrencyFromCents(CRM_BILLING_PLAN.amountCents),
      interval: CRM_BILLING_PLAN.interval,
      overageMultiplier: AI_OVERAGE_MULTIPLIER,
    },
    stripe: {
      configured: Boolean(getStripe()),
      priceConfigured: Boolean(priceId),
      priceId: priceId || null,
      customerPortalReady: Boolean(subscription?.stripeCustomerId),
    },
    subscription,
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    aiUsage: usage,
    recentMessages: recentMessages.map((row) => ({
      id: String(row.id),
      model: String(row.model || 'unknown'),
      createdAt: isoOrNull(row.created_at),
      inputTokens: numberFrom(row.input_tokens),
      outputTokens: numberFrom(row.output_tokens),
      providerCostUsd: numberFrom(row.estimated_cost_usd),
      contentPreview: String(row.content || '').slice(0, 120),
    })),
    usagePeriods,
    invoices,
  };
}

export async function createBillingCheckoutSession(input: {
  companyId: string;
  clerkUserId: string;
  customerEmail?: string | null;
  customerName?: string | null;
}): Promise<{ url: string } | { error: string; status: number }> {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured.', status: 503 };
  const priceId = resolveCrmBillingPriceId();
  if (!priceId) return { error: 'Missing STRIPE_PRICE_AWP_CRM_MONTHLY.', status: 400 };

  const existing = await getCurrentBillingSubscription(input.companyId);
  if (existing && ['active', 'trialing', 'past_due', 'incomplete'].includes(existing.status)) {
    if (existing.stripeCustomerId) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: existing.stripeCustomerId,
        return_url: `${billingAppBaseUrl()}/billing`,
      });
      if (!portal.url) return { error: 'Stripe did not return a portal URL.', status: 502 };
      return { url: portal.url };
    }
  }

  const metadata = {
    billing_kind: 'crm_subscription',
    plan: CRM_BILLING_PLAN.key,
    billing_cycle: 'monthly',
    price_id: priceId,
    company_id: input.companyId,
    clerk_user_id: input.clerkUserId,
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer: existing?.stripeCustomerId || undefined,
    customer_email: existing?.stripeCustomerId ? undefined : input.customerEmail || undefined,
    customer_creation: existing?.stripeCustomerId ? undefined : 'always',
    client_reference_id: input.companyId,
    subscription_data: { metadata },
    metadata,
    success_url: `${billingAppBaseUrl()}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${billingAppBaseUrl()}/billing?checkout=cancelled`,
  });
  if (!session.url) return { error: 'Stripe did not return a checkout URL.', status: 502 };
  return { url: session.url };
}

export async function createBillingPortalSession(companyId: string): Promise<{ url: string } | { error: string; status: number }> {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe is not configured.', status: 503 };
  const subscription = await getCurrentBillingSubscription(companyId);
  if (!subscription?.stripeCustomerId) {
    return { error: 'No Stripe customer found for this company.', status: 404 };
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${billingAppBaseUrl()}/billing`,
  });
  if (!session.url) return { error: 'Stripe did not return a portal URL.', status: 502 };
  return { url: session.url };
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } };
  };
  const value = raw.subscription || raw.parent?.subscription_details?.subscription;
  if (!value) return null;
  return typeof value === 'string' ? value : value.id || null;
}

function invoicePeriod(invoice: Stripe.Invoice): { start: Date; end: Date } | null {
  const raw = invoice as unknown as { period_start?: number | null; period_end?: number | null };
  if (!raw.period_start || !raw.period_end || raw.period_end <= raw.period_start) return null;
  return {
    start: new Date(raw.period_start * 1000),
    end: new Date(raw.period_end * 1000),
  };
}

export async function createAiOverageInvoiceItemForInvoice(invoice: Stripe.Invoice): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  const status = String((invoice as unknown as { status?: string | null }).status || '');
  if (status && status !== 'draft') return;

  const stripeSubscriptionId = subscriptionIdFromInvoice(invoice);
  const period = invoicePeriod(invoice);
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null;
  if (!stripeSubscriptionId || !period || !customerId) return;

  const priceId = resolveCrmBillingPriceId();
  const subRows = priceId
    ? await sql`
        SELECT id, company_id, plan, price_id
        FROM billing_subscriptions
        WHERE stripe_subscription_id = ${stripeSubscriptionId}
          AND (plan = ${CRM_BILLING_PLAN.key} OR price_id = ${priceId})
        LIMIT 1
      `
    : await sql`
        SELECT id, company_id, plan, price_id
        FROM billing_subscriptions
        WHERE stripe_subscription_id = ${stripeSubscriptionId}
          AND plan = ${CRM_BILLING_PLAN.key}
        LIMIT 1
      `;
  const sub = subRows[0] as { company_id?: string | null } | undefined;
  const companyId = sub?.company_id;
  if (!companyId) return;

  const existingRows = await sql`
    SELECT id, stripe_invoice_item_id
    FROM billing_usage_periods
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
      AND period_start = ${sqlDateTime(period.start)}
      AND period_end = ${sqlDateTime(period.end)}
    LIMIT 1
  `;
  const existing = existingRows[0] as { id?: string; stripe_invoice_item_id?: string | null } | undefined;
  if (existing?.stripe_invoice_item_id) return;

  const { usage } = await getAiUsageForPeriod(companyId, period.start, period.end);
  const chargeAmountCents = calculateAiOverageCents(usage.providerCostUsd, AI_OVERAGE_MULTIPLIER);
  const periodId = existing?.id || randomUUID();
  const baseMeta = {
    billing_kind: 'ai_usage_overage',
    company_id: companyId,
    stripe_subscription_id: stripeSubscriptionId,
    period_start: sqlDateTime(period.start),
    period_end: sqlDateTime(period.end),
    provider_cost_usd: usage.providerCostUsd.toFixed(8),
    multiplier: String(AI_OVERAGE_MULTIPLIER),
  };

  await sql`
    INSERT INTO billing_usage_periods (
      id, company_id, stripe_customer_id, stripe_subscription_id, stripe_invoice_id,
      period_start, period_end, provider_cost_usd, multiplier, charge_amount_cents,
      currency, status, metadata_json
    ) VALUES (
      ${periodId},
      ${companyId},
      ${customerId},
      ${stripeSubscriptionId},
      ${invoice.id},
      ${sqlDateTime(period.start)},
      ${sqlDateTime(period.end)},
      ${usage.providerCostUsd.toFixed(8)},
      ${String(AI_OVERAGE_MULTIPLIER)},
      ${chargeAmountCents},
      ${CRM_BILLING_PLAN.currency},
      ${chargeAmountCents > 0 ? 'pending' : 'no_charge'},
      ${JSON.stringify(baseMeta)}
    )
    ON CONFLICT(stripe_subscription_id, period_start, period_end) DO UPDATE SET
      stripe_invoice_id = excluded.stripe_invoice_id,
      provider_cost_usd = excluded.provider_cost_usd,
      multiplier = excluded.multiplier,
      charge_amount_cents = excluded.charge_amount_cents,
      status = CASE
        WHEN billing_usage_periods.stripe_invoice_item_id IS NOT NULL THEN billing_usage_periods.status
        ELSE excluded.status
      END,
      metadata_json = excluded.metadata_json,
      updated_at = datetime('now')
  `;

  if (chargeAmountCents <= 0) return;

  const item = await stripe.invoiceItems.create(
    {
      customer: customerId,
      invoice: invoice.id,
      amount: chargeAmountCents,
      currency: CRM_BILLING_PLAN.currency,
      description: `AI assistant usage overage (${AI_OVERAGE_MULTIPLIER}x provider cost)`,
      metadata: baseMeta,
    },
    { idempotencyKey: `ai-overage:${invoice.id}:${stripeSubscriptionId}` },
  );

  await sql`
    UPDATE billing_usage_periods
    SET stripe_invoice_item_id = ${item.id},
        status = 'invoice_item_created',
        updated_at = datetime('now')
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
      AND period_start = ${sqlDateTime(period.start)}
      AND period_end = ${sqlDateTime(period.end)}
  `;
}

export async function markBillingInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  await sql`
    UPDATE billing_usage_periods
    SET status = 'paid', updated_at = datetime('now')
    WHERE stripe_invoice_id = ${invoice.id}
  `;
}

export async function markBillingInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  await sql`
    UPDATE billing_usage_periods
    SET status = 'payment_failed', updated_at = datetime('now')
    WHERE stripe_invoice_id = ${invoice.id}
  `;
}
