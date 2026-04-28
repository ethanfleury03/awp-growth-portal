'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';

type Payment = {
  id: string;
  source_type: string;
  source_id: string;
  stripe_payment_intent_id: string | null;
  stripe_account_id: string | null;
  amount_cents: number;
  refunded_amount_cents: number;
  application_fee_cents: number | null;
  currency: string;
  status: string;
  customer_email: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  failed_at: string | null;
  created_at: string;
};

function fmtMoney(cents: number, currency: string) {
  const amt = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amt);
  } catch {
    return `$${amt.toFixed(2)}`;
  }
}

export default function PaymentsLedgerPage() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments?limit=200', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setRows(json.payments as Payment[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refund(p: Payment) {
    const remaining = p.amount_cents - p.refunded_amount_cents;
    const input = window.prompt(
      `Refund amount in ${p.currency.toUpperCase()} (max ${fmtMoney(remaining, p.currency)}). Leave blank for full refund.`,
      '',
    );
    if (input === null) return;
    let amountCents: number | undefined;
    if (input.trim() !== '') {
      const parsed = Number(input.replace(/[^0-9.]/g, ''));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        alert('Invalid amount');
        return;
      }
      amountCents = Math.round(parsed * 100);
    }
    setRefundingId(p.id);
    try {
      const res = await fetch(`/api/payments/${p.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, reason: 'requested_by_customer' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Refund failed');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Refund failed');
    } finally {
      setRefundingId(null);
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payments ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All customer charges, refunds, and application fees for this company.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          <RotateCcw className="size-4" /> Refresh
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Refunded</th>
                <th className="px-3 py-2 font-medium">Fee</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => {
                const remaining = p.amount_cents - p.refunded_amount_cents;
                const canRefund = ['paid', 'partial_refund'].includes(p.status) && remaining > 0;
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div>{p.source_type.replace('_', ' ')}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.source_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtMoney(p.amount_cents, p.currency)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {p.refunded_amount_cents > 0 ? fmtMoney(p.refunded_amount_cents, p.currency) : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {p.application_fee_cents != null
                        ? fmtMoney(p.application_fee_cents, p.currency)
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={[
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          p.status === 'paid' && 'bg-emerald-100 text-emerald-800',
                          p.status === 'pending' && 'bg-amber-100 text-amber-800',
                          p.status === 'failed' && 'bg-red-100 text-red-800',
                          p.status === 'refunded' && 'bg-gray-200 text-gray-800',
                          p.status === 'partial_refund' && 'bg-blue-100 text-blue-800',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{p.customer_email || '—'}</td>
                    <td className="px-3 py-2">
                      {canRefund && (
                        <button
                          type="button"
                          onClick={() => refund(p)}
                          disabled={refundingId === p.id}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-60"
                        >
                          {refundingId === p.id ? 'Refunding…' : 'Refund'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
