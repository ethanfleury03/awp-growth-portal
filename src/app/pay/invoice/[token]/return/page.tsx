'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function InvoicePayReturnPage() {
  const { token } = useParams<{ token: string }>();
  const search = useSearchParams();
  const sessionId = search.get('session_id');
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState('');

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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-red-600">{err}</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Checking payment…
      </div>
    );
  }

  const paid = String(invoice.status) === 'paid';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center space-y-4">
        <h1 className="text-xl font-semibold">Invoice payment</h1>
        {paid ? (
          <p className="text-emerald-800">Thank you — payment received for {String(invoice.invoice_number)}.</p>
        ) : (
          <p className="text-slate-700">
            {sessionId
              ? 'If you completed payment, confirmation can take a moment. Refresh this page.'
              : 'Return to the invoice page to complete payment.'}
          </p>
        )}
        <Link
          href={`/pay/invoice/${token}`}
          className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white font-medium hover:bg-teal-800"
        >
          Back to invoice
        </Link>
      </div>
    </div>
  );
}
