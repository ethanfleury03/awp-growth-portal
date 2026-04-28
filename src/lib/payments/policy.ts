import { getCompanyPaymentSettings } from '@/lib/payments/company-settings';

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export async function onlinePaymentsActive(companyId: string): Promise<boolean> {
  if (!stripeConfigured()) return false;
  const s = await getCompanyPaymentSettings(companyId);
  return s.online_payments_enabled;
}

export function estimateDepositAmountCents(row: Record<string, unknown>): number {
  return Math.max(0, Math.round(Number(row.deposit_amount_cents) || 0));
}

/** Public customer cannot use "Approve" until deposit is paid (or waived by staff). */
export async function depositBlocksPublicApproval(est: Record<string, unknown>): Promise<boolean> {
  const companyId = est.company_id as string;
  if (!(await onlinePaymentsActive(companyId))) return false;
  const s = await getCompanyPaymentSettings(companyId);
  if (!s.estimate_deposits_enabled) return false;
  if (estimateDepositAmountCents(est) <= 0) return false;
  const st = String(est.deposit_status || 'none');
  return st !== 'paid' && st !== 'waived';
}

/** Converting to job requires deposit collected when company policy + amount demand it. */
export async function depositBlocksConvert(est: Record<string, unknown>): Promise<boolean> {
  const companyId = est.company_id as string;
  const s = await getCompanyPaymentSettings(companyId);
  if (!s.estimate_deposits_enabled) return false;
  if (estimateDepositAmountCents(est) <= 0) return false;
  const st = String(est.deposit_status || 'none');
  return st !== 'paid' && st !== 'waived';
}

export async function invoicePaymentsAllowed(companyId: string): Promise<boolean> {
  if (!(await onlinePaymentsActive(companyId))) return false;
  const s = await getCompanyPaymentSettings(companyId);
  return s.invoice_payments_enabled;
}
