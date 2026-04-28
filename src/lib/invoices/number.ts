import type Database from 'better-sqlite3';

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
export function allocateInvoiceNumber(
  db: Database.Database,
  companyId: string,
  prefix: string = 'INV',
): string {
  const year = new Date().getFullYear();
  const safePrefix = sanitizePrefix(prefix);
  const safeCompanyCode = companyCode(companyId);

  const tx = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT last_seq FROM invoice_number_sequences WHERE company_id = ? AND year = ?`,
      )
      .get(companyId, year) as { last_seq: number } | undefined;

    let next = 1;
    if (row) {
      next = Number(row.last_seq) + 1;
      db.prepare(
        `UPDATE invoice_number_sequences SET last_seq = ? WHERE company_id = ? AND year = ?`,
      ).run(next, companyId, year);
    } else {
      db.prepare(
        `INSERT INTO invoice_number_sequences (company_id, year, last_seq) VALUES (?, ?, 1)`,
      ).run(companyId, year);
    }

    return `${safePrefix}-${safeCompanyCode}-${year}-${String(next).padStart(4, '0')}`;
  });

  return tx();
}
