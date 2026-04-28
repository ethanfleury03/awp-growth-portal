import { describe, expect, it } from 'vitest';
import { invoiceAmountsCents } from '@/lib/payments/invoice-money';

describe('invoiceAmountsCents', () => {
  it('prefers integer cents columns when present', () => {
    expect(
      invoiceAmountsCents({
        amount_cents: 1000,
        tax_cents: 82,
        total_cents: 1082,
        amount: 9.99,
        tax: 0.5,
        total: 99,
      }),
    ).toEqual({ amountCents: 1000, taxCents: 82, totalCents: 1082 });
  });

  it('falls back to REAL dollars when cents missing', () => {
    expect(
      invoiceAmountsCents({
        amount: 10.5,
        tax: 1.25,
        total: 11.75,
      }),
    ).toEqual({ amountCents: 1050, taxCents: 125, totalCents: 1175 });
  });

  it('treats non-finite total_cents as missing', () => {
    expect(
      invoiceAmountsCents({
        total_cents: NaN,
        amount: 2,
        tax: 0,
        total: 2,
      }).totalCents,
    ).toBe(200);
  });
});
