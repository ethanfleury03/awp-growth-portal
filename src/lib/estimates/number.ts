import { sql } from '@/lib/db';

/**
 * Allocates next per-company, per-year sequence and returns full estimate_number.
 */
export async function allocateEstimateNumber(
  companyId: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const safePrefix = (prefix || 'EST').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || 'EST';
  const rows = await sql`
    INSERT INTO estimate_number_sequences (company_id, year, last_seq)
    VALUES (${companyId}, ${year}, 1)
    ON CONFLICT (company_id, year)
    DO UPDATE SET last_seq = estimate_number_sequences.last_seq + 1
    RETURNING last_seq
  `;
  const next = Number(rows[0]?.last_seq || 1);
  return `${safePrefix}-${year}-${String(next).padStart(4, '0')}`;
}
