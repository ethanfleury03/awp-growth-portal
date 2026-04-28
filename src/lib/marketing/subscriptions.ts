import { randomUUID } from 'crypto';
import type Stripe from 'stripe';
import { sql } from '@/lib/db';

export type MarketingPlan = 'starter' | 'pro';
export type BillingCycle = 'monthly' | 'annual';

export function marketingAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    'http://localhost:3003'
  );
}

export function resolveMarketingPriceId(
  plan: MarketingPlan,
  billingCycle: BillingCycle,
): string | undefined {
  if (plan === 'starter' && billingCycle === 'monthly') {
    return process.env.STRIPE_PRICE_STARTER_MONTHLY?.trim();
  }
  if (plan === 'starter' && billingCycle === 'annual') {
    return process.env.STRIPE_PRICE_STARTER_ANNUAL?.trim();
  }
  if (plan === 'pro' && billingCycle === 'monthly') {
    return process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
  }
  if (plan === 'pro' && billingCycle === 'annual') {
    return process.env.STRIPE_PRICE_PRO_ANNUAL?.trim();
  }
  return undefined;
}

export async function ensureBillingSubscriptionsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      clerk_user_id TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT NOT NULL UNIQUE,
      stripe_checkout_session_id TEXT,
      price_id TEXT,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'incomplete',
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      trial_ends_at TEXT,
      current_period_end TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_company
    ON billing_subscriptions(company_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
    ON billing_subscriptions(status)
  `;
}

function toIso(ts?: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

function deriveBillingCycle(priceLookup?: string | null): BillingCycle {
  if (!priceLookup) return 'monthly';
  return /annual|year/i.test(priceLookup) ? 'annual' : 'monthly';
}

function derivePlan(priceLookup?: string | null): MarketingPlan {
  return /pro/i.test(priceLookup || '') ? 'pro' : 'starter';
}

export async function upsertBillingSubscriptionFromCheckout(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  if (!subId) return;

  const priceId = session.metadata?.price_id || null;
  const plan = (session.metadata?.plan as MarketingPlan | undefined) || derivePlan(priceId);
  const billingCycle =
    (session.metadata?.billing_cycle as BillingCycle | undefined) || deriveBillingCycle(priceId);
  const companyId = session.metadata?.company_id || null;
  const clerkUserId = session.metadata?.clerk_user_id || null;
  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id || null;

  await ensureBillingSubscriptionsTable();
  await sql`
    INSERT INTO billing_subscriptions (
      id, company_id, clerk_user_id, stripe_customer_id, stripe_subscription_id,
      stripe_checkout_session_id, price_id, plan, status, billing_cycle,
      trial_ends_at, current_period_end, metadata_json, created_at, updated_at
    ) VALUES (
      ${randomUUID()},
      ${companyId},
      ${clerkUserId},
      ${stripeCustomerId},
      ${subId},
      ${session.id},
      ${priceId},
      ${plan},
      ${session.status || 'complete'},
      ${billingCycle},
      ${null},
      ${null},
      ${JSON.stringify(session.metadata || {})},
      datetime('now'),
      datetime('now')
    )
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      company_id = COALESCE(excluded.company_id, billing_subscriptions.company_id),
      clerk_user_id = COALESCE(excluded.clerk_user_id, billing_subscriptions.clerk_user_id),
      stripe_customer_id = COALESCE(excluded.stripe_customer_id, billing_subscriptions.stripe_customer_id),
      stripe_checkout_session_id = excluded.stripe_checkout_session_id,
      price_id = COALESCE(excluded.price_id, billing_subscriptions.price_id),
      plan = excluded.plan,
      status = excluded.status,
      billing_cycle = excluded.billing_cycle,
      metadata_json = excluded.metadata_json,
      updated_at = datetime('now')
  `;
}

export async function upsertBillingSubscriptionFromSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id || null;
  const priceId = subscription.items.data[0]?.price?.id || null;

  const trialEndsAt = toIso(subscription.trial_end || null);
  const currentPeriodEnd = toIso(
    (subscription as unknown as { current_period_end?: number }).current_period_end || null,
  );

  const rows = await sql`
    SELECT plan, billing_cycle, company_id, clerk_user_id, stripe_checkout_session_id
    FROM billing_subscriptions
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
    LIMIT 1
  `;
  const existing = rows[0] as
    | {
        plan?: string | null;
        billing_cycle?: string | null;
        company_id?: string | null;
        clerk_user_id?: string | null;
        stripe_checkout_session_id?: string | null;
      }
    | undefined;

  const plan = (existing?.plan as MarketingPlan | undefined) || derivePlan(priceId);
  const billingCycle =
    (existing?.billing_cycle as BillingCycle | undefined) || deriveBillingCycle(priceId);

  await ensureBillingSubscriptionsTable();
  await sql`
    INSERT INTO billing_subscriptions (
      id, company_id, clerk_user_id, stripe_customer_id, stripe_subscription_id,
      stripe_checkout_session_id, price_id, plan, status, billing_cycle,
      trial_ends_at, current_period_end, metadata_json, created_at, updated_at
    ) VALUES (
      ${randomUUID()},
      ${existing?.company_id || null},
      ${existing?.clerk_user_id || null},
      ${stripeCustomerId},
      ${stripeSubscriptionId},
      ${existing?.stripe_checkout_session_id || null},
      ${priceId},
      ${plan},
      ${subscription.status},
      ${billingCycle},
      ${trialEndsAt},
      ${currentPeriodEnd},
      ${JSON.stringify(subscription.metadata || {})},
      datetime('now'),
      datetime('now')
    )
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      stripe_customer_id = COALESCE(excluded.stripe_customer_id, billing_subscriptions.stripe_customer_id),
      price_id = COALESCE(excluded.price_id, billing_subscriptions.price_id),
      plan = excluded.plan,
      status = excluded.status,
      billing_cycle = excluded.billing_cycle,
      trial_ends_at = excluded.trial_ends_at,
      current_period_end = excluded.current_period_end,
      metadata_json = excluded.metadata_json,
      updated_at = datetime('now')
  `;
}

export async function markBillingSubscriptionPastDue(
  invoice: Stripe.Invoice,
): Promise<void> {
  const rawSubscription =
    (invoice as unknown as { subscription?: string | { id?: string } }).subscription ||
    (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent
      ?.subscription_details?.subscription;
  const subId =
    typeof rawSubscription === 'string'
      ? rawSubscription
      : rawSubscription?.id;
  if (!subId) return;

  await ensureBillingSubscriptionsTable();
  await sql`
    UPDATE billing_subscriptions
    SET status = 'past_due',
        updated_at = datetime('now')
    WHERE stripe_subscription_id = ${subId}
  `;
}
