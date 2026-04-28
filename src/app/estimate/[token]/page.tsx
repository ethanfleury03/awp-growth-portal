'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type ApprovalInfo = {
  customerSignatureRequired: boolean;
  allowCustomerReject: boolean;
};

type PaymentInfo = {
  stripeSecretConfigured: boolean;
  onlinePaymentsEnabled: boolean;
  estimateDepositsEnabled: boolean;
  depositAmountCents: number;
  depositStatus: string;
  mustPayBeforeApprove: boolean;
  depositCheckoutAvailable: boolean;
};

type Presentation = {
  estimate: Record<string, unknown>;
  lineItems: Record<string, unknown>[];
  branding: Record<string, unknown>;
  publicUrl: string;
  approval?: ApprovalInfo;
  payment?: PaymentInfo;
};

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function groupSortKey(label: string): [number, string] {
  const t = label.trim().toLowerCase();
  if (t === 'good') return [0, label];
  if (t === 'better') return [1, label];
  if (t === 'best') return [2, label];
  if (!t) return [99, ''];
  return [50, label.toLowerCase()];
}

function groupHeading(label: string): string {
  if (!label.trim()) return 'Scope';
  const t = label.trim().toLowerCase();
  if (t === 'good') return 'Good';
  if (t === 'better') return 'Better';
  if (t === 'best') return 'Best';
  return label;
}

export default function PublicEstimatePage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Presentation | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const [signerName, setSignerName] = useState('');

  const grouped = useMemo(() => {
    if (!data) return [] as { group: string; items: Record<string, unknown>[] }[];
    const m = new Map<string, Record<string, unknown>[]>();
    for (const li of data.lineItems) {
      const g = String((li.option_group as string) || '');
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(li);
    }
    return [...m.entries()]
      .sort((a, b) => {
        const ka = groupSortKey(a[0]);
        const kb = groupSortKey(b[0]);
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        return ka[1].localeCompare(kb[1]);
      })
      .map(([group, items]) => ({ group, items }));
  }, [data]);

  useEffect(() => {
    if (searchParams.get('deposit') === 'cancelled') {
      setErr('Checkout was cancelled. You can try again when you’re ready.');
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/estimate/${token}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Not found');
        if (!cancelled) setData(j as Presentation);
        await fetch(`/api/public/estimate/${token}/view`, { method: 'POST' });
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function approve() {
    setMsg('');
    setErr('');
    try {
      const needSig = Boolean(data?.approval?.customerSignatureRequired);
      if (needSig && !acknowledge) {
        setErr('Please check the box to confirm you approve this estimate.');
        return;
      }
      const res = await fetch(`/api/public/estimate/${token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acknowledge: needSig ? true : undefined,
          signerName: signerName.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setData(j.presentation as Presentation);
      setMsg('Thank you — your approval has been recorded.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    }
  }

  async function payDeposit() {
    setMsg('');
    setErr('');
    try {
      const res = await fetch(`/api/public/estimate/${token}/checkout-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to start checkout');
      if (j.url) window.location.href = j.url as string;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    }
  }

  async function reject() {
    setMsg('');
    if (data?.approval && !data.approval.allowCustomerReject) {
      setErr('Declining this estimate online is not enabled. Please contact the office.');
      return;
    }
    const reason = window.prompt('Optional reason for declining:') || '';
    try {
      const res = await fetch(`/api/public/estimate/${token}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setData(j.presentation as Presentation);
      setMsg('Thanks — we have recorded your response.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    }
  }

  if (err && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-red-600">{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500">
        Loading estimate…
      </div>
    );
  }

  const e = data.estimate;
  const accent = String(data.branding.accentColor || '#0f766e');
  const status = String(e.status);
  const canAct = status === 'sent' || status === 'viewed';
  const done = status === 'approved' || status === 'rejected' || status === 'converted' || status === 'expired';
  const allowReject = data.approval?.allowCustomerReject !== false;
  const needAck = Boolean(data.approval?.customerSignatureRequired);
  const pay = data.payment;
  const depCents = pay?.depositAmountCents ?? 0;
  const depStat = pay?.depositStatus ?? String(e.deposit_status || 'none');
  const showDeposit =
    Boolean(pay?.depositCheckoutAvailable) && depCents > 0 && depStat !== 'paid' && depStat !== 'waived';
  const blockApprove = Boolean(pay?.mustPayBeforeApprove);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-10 print:py-4">
        <header
          className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 mb-6 print:shadow-none"
          style={{ borderTop: `4px solid ${accent}` }}
        >
          <p className="text-xs uppercase tracking-widest text-slate-500">Estimate</p>
          <h1 className="text-2xl font-bold mt-1">{String(data.branding.companyName)}</h1>
          <p className="text-sm text-slate-600 mt-2 font-mono">{String(e.estimate_number)}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 font-medium capitalize">{status}</span>
            {e.expiration_date ? (
              <span className="text-slate-600">Valid through {String(e.expiration_date)}</span>
            ) : null}
          </div>
        </header>

        {msg ? (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm px-4 py-3 no-print">
            {msg}
          </div>
        ) : null}
        {err && data ? (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 no-print">
            {err}
          </div>
        ) : null}

        <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 mb-6 print:shadow-none">
          <h2 className="text-lg font-semibold">{String(e.title)}</h2>
          <p className="text-sm text-slate-600 mt-1">Prepared for {String(e.customer_name_snapshot)}</p>
          {e.service_address_snapshot ? (
            <p className="text-sm text-slate-600 mt-2">Service location: {String(e.service_address_snapshot)}</p>
          ) : null}
          {e.description ? <p className="text-sm mt-4 text-slate-700 whitespace-pre-wrap">{String(e.description)}</p> : null}
        </section>

        {grouped.map(({ group, items }) => (
          <section
            key={group || '__default__'}
            className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden mb-6 print:shadow-none"
          >
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">{groupHeading(group)}</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-600 text-left">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 w-20">Qty</th>
                  <th className="px-4 py-3 w-28 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((li) => (
                  <tr key={li.id as string} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{String(li.name)}</span>
                      {li.description ? <p className="text-slate-600 text-xs mt-1">{String(li.description)}</p> : null}
                    </td>
                    <td className="px-4 py-3">{Number(li.quantity)}</td>
                    <td className="px-4 py-3 text-right font-medium">{money(Number(li.total_price_cents))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <section className="rounded-2xl bg-white shadow-sm border border-slate-200 px-4 py-4 mb-6 print:shadow-none">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span>{money(Number(e.subtotal_amount_cents))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Discount</span>
              <span>-{money(Number(e.discount_amount_cents))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Tax</span>
              <span>{money(Number(e.tax_amount_cents))}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200">
              <span>Total</span>
              <span>{money(Number(e.total_amount_cents))}</span>
            </div>
            {depCents > 0 ? (
              <div className="flex justify-between text-sm pt-2 border-t border-slate-100 text-amber-900">
                <span>Deposit due</span>
                <span className="font-semibold">{money(depCents)}</span>
              </div>
            ) : null}
          </div>
        </section>

        {e.notes_customer ? (
          <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 mb-6 text-sm print:shadow-none">
            <h3 className="font-semibold mb-2">Notes</h3>
            <p className="text-slate-700 whitespace-pre-wrap">{String(e.notes_customer)}</p>
          </section>
        ) : null}

        {data.branding.terms ? (
          <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 mb-6 text-sm text-slate-600 print:shadow-none">
            <h3 className="font-semibold text-slate-900 mb-2">Terms</h3>
            <p className="whitespace-pre-wrap">{String(data.branding.terms)}</p>
          </section>
        ) : null}

        {data.branding.footer ? (
          <p className="text-center text-xs text-slate-500 mb-8">{String(data.branding.footer)}</p>
        ) : null}

        <div className="no-print flex flex-col gap-4">
          {canAct && needAck ? (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 rounded border-slate-300"
                checked={acknowledge}
                onChange={(ev) => setAcknowledge(ev.target.checked)}
              />
              <span>I have reviewed this estimate and approve the scope and pricing shown.</span>
            </label>
          ) : null}
          {canAct && needAck ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <label className="block text-slate-700 font-medium mb-1">Your name (optional)</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                placeholder="Printed on approval record"
                value={signerName}
                onChange={(ev) => setSignerName(ev.target.value)}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 justify-center">
            {canAct && blockApprove ? (
              <p className="w-full text-center text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                A deposit is required before you can approve this estimate. Pay the deposit below (secure checkout).
              </p>
            ) : null}
            {canAct && showDeposit ? (
              <button
                type="button"
                onClick={() => void payDeposit()}
                className="px-6 py-3 rounded-xl text-white font-semibold shadow bg-slate-900 hover:bg-slate-800"
              >
                Pay deposit
              </button>
            ) : null}
            {canAct ? (
              <>
                <button
                  type="button"
                  onClick={approve}
                  disabled={blockApprove}
                  className="px-6 py-3 rounded-xl text-white font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: accent }}
                >
                  Approve estimate
                </button>
                {allowReject ? (
                  <button
                    type="button"
                    onClick={reject}
                    className="px-6 py-3 rounded-xl border border-slate-300 font-semibold"
                  >
                    Decline
                  </button>
                ) : null}
              </>
            ) : null}
            {done ? (
              <p className="text-sm text-slate-600">
                {status === 'approved' && 'This estimate has been approved.'}
                {status === 'rejected' && 'This estimate was declined.'}
                {status === 'converted' && 'This estimate has been scheduled as work.'}
                {status === 'expired' && 'This estimate is no longer valid.'}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
