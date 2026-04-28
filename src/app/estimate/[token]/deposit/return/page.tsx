'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type Presentation = {
  estimate: Record<string, unknown>;
  payment?: {
    depositStatus: string;
    mustPayBeforeApprove?: boolean;
  };
};

export default function EstimateDepositReturnPage() {
  const { token } = useParams<{ token: string }>();
  const search = useSearchParams();
  const sessionId = search.get('session_id');
  const [data, setData] = useState<Presentation | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/estimate/${token}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Not found');
        if (!cancelled) setData(j as Presentation);
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

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Checking payment status…
      </div>
    );
  }

  const st = String(data.estimate.status);
  const dep = String(data.payment?.depositStatus || data.estimate.deposit_status || 'none');
  const paid = dep === 'paid' || st === 'approved';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center space-y-4">
        <h1 className="text-xl font-semibold">Deposit</h1>
        {paid ? (
          <p className="text-slate-700">
            Thank you — your deposit has been received and your estimate is approved.
          </p>
        ) : (
          <p className="text-slate-700">
            {sessionId
              ? 'If you just finished paying, your confirmation may take a few seconds. Refresh this page or return to your estimate.'
              : 'No payment session was found. Return to your estimate to try again.'}
          </p>
        )}
        <Link
          href={`/estimate/${token}`}
          className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white font-medium hover:bg-teal-800"
        >
          Back to estimate
        </Link>
      </div>
    </div>
  );
}
