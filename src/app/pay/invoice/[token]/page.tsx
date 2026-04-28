'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default function PublicInvoicePayPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/invoice/${token}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Not found');
        if (!cancelled) setInvoice(j.invoice as Record<string, unknown>);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function pay() {
    setErr('');
    setPaying(true);
    try {
      const res = await fetch(`/api/public/invoice/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Could not start checkout');
      if (j.url) window.location.href = j.url as string;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading…
      </div>
    );
  }

  if (err && !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-red-600">{err}</p>
      </div>
    );
  }

  if (!invoice) return null;

  const status = String(invoice.status);
  const totalCents = Number(invoice.totalCents ?? invoice.total_cents ?? 0);
  const lineItems = (invoice.line_items as Array<Record<string, unknown>> | undefined) ?? [];
  const taxCents = Number(invoice.taxCents ?? invoice.tax_cents ?? 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 shadow-sm p-8 space-y-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">Invoice</p>
        <h1 className="text-2xl font-bold">{String(invoice.invoice_number)}</h1>
        <p className="text-slate-600 text-sm">
          {invoice.customer_name ? <>Bill to {String(invoice.customer_name)}</> : null}
        </p>
        {lineItems.length > 0 ? (
          <ul className="text-sm border border-slate-100 rounded-lg divide-y divide-slate-100">
            {lineItems.map((li) => (
              <li key={String(li.id)} className="flex justify-between gap-3 px-3 py-2">
                <span className="text-slate-700">
                  {String(li.name)}
                  <span className="text-slate-500">
                    {' '}
                    × {Number(li.quantity)}
                  </span>
                </span>
                <span className="font-mono text-slate-900">{money(Number(li.line_total_cents))}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {taxCents > 0 ? (
          <div className="flex justify-between text-sm text-slate-600">
            <span>Tax</span>
            <span className="font-mono">{money(taxCents)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-lg font-semibold border-t border-slate-100 pt-4">
          <span>Amount due</span>
          <span>{money(totalCents)}</span>
        </div>
        {status === 'paid' ? (
          <p className="text-emerald-800 text-sm">This invoice is already paid. Thank you.</p>
        ) : (
          <>
            {err ? <p className="text-red-600 text-sm">{err}</p> : null}
            <button
              type="button"
              onClick={() => pay()}
              disabled={paying || totalCents <= 0}
              className="w-full py-3 rounded-xl bg-teal-700 text-white font-semibold hover:bg-teal-800 disabled:opacity-50"
            >
              {paying ? 'Redirecting…' : 'Pay securely'}
            </button>
            <p className="text-xs text-slate-500 text-center">You will be redirected to Stripe Checkout.</p>
          </>
        )}
      </div>
    </div>
  );
}
