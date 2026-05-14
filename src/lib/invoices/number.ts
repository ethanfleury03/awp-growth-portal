import { sql } from '@/lib/db';

function sanitizePrefix(prefix: string): string {
  return (prefix || 'INV').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || 'INV';
}

function companyCode(companyId: string): string {
  return companyId.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'CO';
}

/**
 * Allocates the next invoice number per company and year. The company fragment
 * keeps numbers globally unique while the schema still enforces a single-column
 * unique constraint on `invoice_number`.
 */
export async function allocateInvoiceNumber(
  companyId: string,
  prefix: string = 'INV',
): Promise<string> {
  const year = new Date().getFullYear();
  const safePrefix = sanitizePrefix(prefix);
  const safeCompanyCode = companyCode(companyId);
  const rows = await sql`
    INSERT INTO invoice_number_sequences (company_id, year, last_seq)
    VALUES (${companyId}, ${year}, 1)
    ON CONFLICT (company_id, year)
    DO UPDATE SET last_seq = invoice_number_sequences.last_seq + 1
    RETURNING last_seq
  `;
  const next = Number(rows[0]?.last_seq || 1);
  return `${safePrefix}-${safeCompanyCode}-${year}-${String(next).padStart(4, '0')}`;
}
