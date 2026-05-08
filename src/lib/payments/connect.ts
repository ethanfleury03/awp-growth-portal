/**
 * Stripe Connect (controller-properties based). WNY Automation Portal is a marketplace
 * where client companies each operate as their own connected account; the
 * platform (WNY Automation Portal) may take an application fee per charge.
 *
 * We use **destination charges** on the platform account so the platform
 * receives the charge and then transfers to the connected account. This keeps
 * the customer experience single-vendor (branded as WNY Automation Portal / the client)
 * while WNY Automation Portal retains data access and chargeback tooling.
 *
 * Controller model (replaces "Standard/Express/Custom" terminology):
 *   - losses.payments      = 'stripe'         (Stripe bears risk on the account)
 *   - fees.payer           = 'account'        (connected account pays Stripe fees)
 *   - stripe_dashboard.type = 'express'       (Express-style dashboard)
 *   - requirement_collection = 'stripe'       (Stripe collects KYC)
 */

import { sql } from '@/lib/db';
import { getStripe } from '@/lib/payments/stripe';
import { paymentsAppBaseUrl } from '@/lib/payments/urls';

export type ConnectStatus =
  | 'pending'
  | 'onboarding'
  | 'restricted'
  | 'enabled'
  | 'rejected';

export interface CompanyConnectInfo {
  companyId: string;
  stripeAccountId: string | null;
  status: ConnectStatus;
  onboardingCompletedAt: string | null;
}

export async function getCompanyConnectInfo(
  companyId: string,
): Promise<CompanyConnectInfo | null> {
  const rows = await sql`
    SELECT id, stripe_account_id, stripe_connect_status, stripe_onboarding_completed_at
    FROM companies
    WHERE id = ${companyId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    companyId: String(r.id),
    stripeAccountId: (r.stripe_account_id as string | null) ?? null,
    status: ((r.stripe_connect_status as string) || 'pending') as ConnectStatus,
    onboardingCompletedAt: (r.stripe_onboarding_completed_at as string | null) ?? null,
  };
}

/**
 * Ensure a Stripe Connect account exists for a company; return its id.
 * Idempotent: returns existing account id on subsequent calls.
 */
export async function ensureConnectAccount(args: {
  companyId: string;
  companyName: string;
  companyEmail: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const info = await getCompanyConnectInfo(args.companyId);
  if (info?.stripeAccountId) return info.stripeAccountId;

  const account = await stripe.accounts.create({
    controller: {
      losses: { payments: 'stripe' },
      fees: { payer: 'account' },
      stripe_dashboard: { type: 'express' },
      requirement_collection: 'stripe',
    },
    country: 'US',
    email: args.companyEmail,
    business_profile: { name: args.companyName },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { plumberos_company_id: args.companyId },
  });

  await sql`
    UPDATE companies
    SET
      stripe_account_id = ${account.id},
      stripe_connect_status = 'onboarding',
      updated_at = datetime('now')
    WHERE id = ${args.companyId}
  `;

  return account.id;
}

export async function createOnboardingLink(args: {
  companyId: string;
  stripeAccountId: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');
  const base = paymentsAppBaseUrl();
  const link = await stripe.accountLinks.create({
    account: args.stripeAccountId,
    refresh_url: `${base}/settings/payments/connect?refresh=1`,
    return_url: `${base}/settings/payments/connect?return=1`,
    type: 'account_onboarding',
    collection_options: { fields: 'currently_due' },
  });
  return link.url;
}

export async function refreshConnectStatus(companyId: string): Promise<ConnectStatus> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');
  const info = await getCompanyConnectInfo(companyId);
  if (!info?.stripeAccountId) return 'pending';

  const acct = await stripe.accounts.retrieve(info.stripeAccountId);
  const status: ConnectStatus = computeConnectStatus(acct);
  const onboardedAt =
    status === 'enabled'
      ? info.onboardingCompletedAt ?? new Date().toISOString()
      : info.onboardingCompletedAt;

  await sql`
    UPDATE companies
    SET
      stripe_connect_status = ${status},
      stripe_onboarding_completed_at = ${onboardedAt},
      updated_at = datetime('now')
    WHERE id = ${companyId}
  `;
  return status;
}

export function computeConnectStatus(account: {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: { disabled_reason?: string | null; currently_due?: string[] | null } | null;
}): ConnectStatus {
  if (account.charges_enabled && account.payouts_enabled) return 'enabled';
  if (account.requirements?.disabled_reason?.startsWith('rejected')) return 'rejected';
  const currentlyDue = account.requirements?.currently_due?.length ?? 0;
  if (account.details_submitted && currentlyDue === 0) return 'enabled';
  if (account.details_submitted) return 'restricted';
  return 'onboarding';
}

/**
 * Get the connected account to use for a Checkout session. Returns null if
 * the company has not finished Connect onboarding, in which case the caller
 * MUST refuse to create a payment (we don't want funds landing on the platform
 * account and being trapped there).
 */
export async function getConnectedAccountForCharge(
  companyId: string,
): Promise<string | null> {
  const info = await getCompanyConnectInfo(companyId);
  if (!info?.stripeAccountId) return null;
  if (info.status !== 'enabled') return null;
  return info.stripeAccountId;
}

/**
 * Platform application fee as basis points (default 2.9%). Set
 * PLATFORM_FEE_BPS in env to override (e.g. "290" for 2.9%, "0" to waive).
 */
export function applicationFeeCents(grossCents: number): number {
  const bps = Number(process.env.PLATFORM_FEE_BPS || '290');
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.floor((grossCents * bps) / 10_000);
}
