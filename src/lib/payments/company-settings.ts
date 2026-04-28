import { sql } from '@/lib/db';

export type CompanyPaymentSettings = {
  company_id: string;
  online_payments_enabled: boolean;
  estimate_deposits_enabled: boolean;
  invoice_payments_enabled: boolean;
  deposit_due_timing: string;
};

function rowToSettings(r: Record<string, unknown>): CompanyPaymentSettings {
  return {
    company_id: String(r.company_id),
    online_payments_enabled: Boolean(Number(r.online_payments_enabled)),
    estimate_deposits_enabled: Boolean(Number(r.estimate_deposits_enabled)),
    invoice_payments_enabled: Boolean(Number(r.invoice_payments_enabled)),
    deposit_due_timing: String(r.deposit_due_timing || 'with_approval'),
  };
}

export async function ensureCompanyPaymentSettings(companyId: string): Promise<CompanyPaymentSettings> {
  const existing = await sql`
    SELECT * FROM company_payment_settings WHERE company_id = ${companyId} LIMIT 1
  `;
  if (existing.length) {
    return rowToSettings(existing[0] as Record<string, unknown>);
  }
  await sql`
    INSERT INTO company_payment_settings (company_id) VALUES (${companyId})
  `;
  const rows = await sql`SELECT * FROM company_payment_settings WHERE company_id = ${companyId} LIMIT 1`;
  return rowToSettings(rows[0] as Record<string, unknown>);
}

export async function getCompanyPaymentSettings(companyId: string): Promise<CompanyPaymentSettings> {
  return ensureCompanyPaymentSettings(companyId);
}

export async function patchCompanyPaymentSettings(
  companyId: string,
  patch: Partial<{
    online_payments_enabled: boolean;
    estimate_deposits_enabled: boolean;
    invoice_payments_enabled: boolean;
    deposit_due_timing: string;
  }>,
): Promise<CompanyPaymentSettings> {
  const cur = await ensureCompanyPaymentSettings(companyId);
  const next = {
    online_payments_enabled: patch.online_payments_enabled ?? cur.online_payments_enabled,
    estimate_deposits_enabled: patch.estimate_deposits_enabled ?? cur.estimate_deposits_enabled,
    invoice_payments_enabled: patch.invoice_payments_enabled ?? cur.invoice_payments_enabled,
    deposit_due_timing: patch.deposit_due_timing ?? cur.deposit_due_timing,
  };
  await sql`
    UPDATE company_payment_settings SET
      online_payments_enabled = ${next.online_payments_enabled ? 1 : 0},
      estimate_deposits_enabled = ${next.estimate_deposits_enabled ? 1 : 0},
      invoice_payments_enabled = ${next.invoice_payments_enabled ? 1 : 0},
      deposit_due_timing = ${next.deposit_due_timing},
      updated_at = datetime('now')
    WHERE company_id = ${companyId}
  `;
  return ensureCompanyPaymentSettings(companyId);
}
