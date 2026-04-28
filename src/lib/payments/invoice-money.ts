/** Normalize invoice row to integer cents (prefers *_cents columns when present). */
export function invoiceAmountsCents(row: Record<string, unknown>): {
  amountCents: number;
  taxCents: number;
  totalCents: number;
} {
  if (row.total_cents != null && Number.isFinite(Number(row.total_cents))) {
    return {
      amountCents: Math.round(Number(row.amount_cents) || 0),
      taxCents: Math.round(Number(row.tax_cents) || 0),
      totalCents: Math.round(Number(row.total_cents) || 0),
    };
  }
  return {
    amountCents: Math.round(Number(row.amount) * 100),
    taxCents: Math.round(Number(row.tax || 0) * 100),
    totalCents: Math.round(Number(row.total) * 100),
  };
}
