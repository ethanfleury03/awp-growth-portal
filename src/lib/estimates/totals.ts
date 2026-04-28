export type LineInput = {
  quantity: number;
  unit_price_cents: number;
  is_taxable: boolean;
};

/** Per-line extended price in cents (rounded). */
export function lineExtendedCents(quantity: number, unitPriceCents: number): number {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q < 0) return 0;
  if (!Number.isFinite(unitPriceCents)) return 0;
  return Math.round(q * unitPriceCents);
}

/**
 * Subtotal = sum of line extended amounts.
 * Discount (whole cents) applied to subtotal first (floor at 0).
 * Tax: basis_points applied only to the taxable portion of the *post-discount* amount
 * (taxable share of subtotal × (1 - discount/subtotal)).
 */
export function calculateEstimateTotals(params: {
  lines: LineInput[];
  discount_amount_cents: number;
  tax_rate_basis_points: number | null | undefined;
}): {
  subtotal_amount_cents: number;
  discount_amount_cents: number;
  taxable_base_after_discount_cents: number;
  tax_amount_cents: number;
  total_amount_cents: number;
} {
  let subtotal = 0;
  let taxableSubtotal = 0;
  for (const line of params.lines) {
    const ext = lineExtendedCents(line.quantity, line.unit_price_cents);
    subtotal += ext;
    if (line.is_taxable) taxableSubtotal += ext;
  }

  const disc = Math.max(0, Math.min(params.discount_amount_cents, subtotal));
  const afterDisc = subtotal - disc;

  const taxBps =
    params.tax_rate_basis_points == null || !Number.isFinite(params.tax_rate_basis_points)
      ? 0
      : Math.max(0, params.tax_rate_basis_points);

  let taxableAfterDisc = 0;
  if (subtotal > 0) {
    const ratio = taxableSubtotal / subtotal;
    taxableAfterDisc = Math.round(afterDisc * ratio);
  }

  const tax = Math.round((taxableAfterDisc * taxBps) / 10_000);
  const total = afterDisc + tax;

  return {
    subtotal_amount_cents: subtotal,
    discount_amount_cents: disc,
    taxable_base_after_discount_cents: taxableAfterDisc,
    tax_amount_cents: tax,
    total_amount_cents: total,
  };
}
