'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  Send,
  Briefcase,
  Printer,
  Plus,
  Trash2,
  FileDown,
} from 'lucide-react';

type PaymentInfo = {
  stripeSecretConfigured: boolean;
  onlinePaymentsEnabled: boolean;
  estimateDepositsEnabled: boolean;
  invoicePaymentsEnabled: boolean;
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
  approval?: { customerSignatureRequired: boolean; allowCustomerReject: boolean };
  payment?: PaymentInfo;
  emailDraft?: {
    defaultSubject: string;
    defaultBody: string;
    toEmail: string | null;
    customerPhone: string | null;
  };
};

type CatalogServiceQuick = {
  id: string;
  name: string;
  description: string | null;
  unit_price_cents: number;
};

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Presentation | null>(null);
  const [activity, setActivity] = useState<Record<string, unknown>[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, unknown>[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogServiceQuick[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [newLine, setNewLine] = useState({ name: '', unit_price_cents: 0, quantity: 1, option_group: '' });
  const [sendEmail, setSendEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const emailDraftInitForId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [main, act, del, cat] = await Promise.all([
        fetch(`/api/estimates/${id}`),
        fetch(`/api/estimates/${id}/activity`),
        fetch(`/api/estimates/${id}/deliveries`),
        fetch('/api/estimates/catalog-services'),
      ]);
      const j = await main.json();
      if (!main.ok) throw new Error(j.error || 'Failed');
      setData(j as Presentation);
      const aj = await act.json();
      setActivity(aj.activity || []);
      const dj = await del.json();
      setDeliveries(dj.deliveries || []);
      const cj = await cat.json();
      setCatalogServices((cj.services as CatalogServiceQuick[]) || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    emailDraftInitForId.current = null;
  }, [id]);

  useEffect(() => {
    if (!data?.emailDraft) return;
    if (emailDraftInitForId.current === id) return;
    emailDraftInitForId.current = id;
    setSendEmail(data.emailDraft.toEmail || '');
    setEmailSubject(data.emailDraft.defaultSubject);
    setEmailBody(data.emailDraft.defaultBody);
  }, [id, data]);

  async function patchEstimate(patch: Record<string, unknown>) {
    const res = await fetch(`/api/estimates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Failed');
    setData((prev) =>
      prev
        ? {
            ...prev,
            estimate: j.estimate,
            lineItems: prev.lineItems,
            branding: prev.branding,
            publicUrl: prev.publicUrl,
            approval: prev.approval,
            payment: prev.payment,
            emailDraft: prev.emailDraft,
          }
        : null,
    );
  }

  async function addLine() {
    if (!newLine.name.trim()) return;
    const res = await fetch(`/api/estimates/${id}/line-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newLine.name,
        quantity: newLine.quantity,
        unit: 'ea',
        unit_price_cents: Math.round(newLine.unit_price_cents),
        option_group: newLine.option_group || null,
      }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Failed');
    setNewLine({ name: '', unit_price_cents: 0, quantity: 1, option_group: '' });
    await load();
  }

  async function removeLine(lineId: string) {
    if (!confirm('Remove this line?')) return;
    const res = await fetch(`/api/estimates/${id}/line-items/${lineId}`, { method: 'DELETE' });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Failed');
    await load();
  }

  async function patchLine(lineId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/estimates/${id}/line-items/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Failed');
    await load();
  }

  async function send() {
    const email = sendEmail.trim();
    if (!email) {
      alert('Add a recipient email before sending.');
      return;
    }
    const res = await fetch(`/api/estimates/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: email,
        channel: 'email' as const,
        emailSubject: emailSubject.trim() || null,
        emailBody: emailBody.trim() || null,
      }),
    });
    const j = (await res.json()) as {
      publicUrl?: string;
      delivery?: {
        status: 'sent' | 'failed';
        provider: string;
        error_message?: string;
      };
      error?: string;
    };
    if (!res.ok) throw new Error(j.error || 'Failed');

    const d = j.delivery;
    const link = j.publicUrl || '';
    if (!d) {
      alert('Unexpected response from server.');
      await load();
      return;
    }

    const via =
      d.provider === 'clerk_gmail'
        ? 'Gmail (your connected Google account)'
        : d.provider === 'clerk_microsoft'
          ? 'Microsoft 365'
          : d.provider === 'resend'
            ? 'Resend'
            : d.provider === 'mock'
              ? 'mock (dev — no real email)'
              : d.provider === 'email_stub'
                ? 'not configured (stub)'
                : d.provider;

    if (d.status === 'failed') {
      alert(
        `Email did not send (${via}).\n\n${d.error_message || 'Unknown error'}\n\nYou can still share this link manually:\n${link}`,
      );
      await load();
      return;
    }

    alert(`Email sent (${via}).\n\nCustomer link:\n${link}`);
    await load();
  }

  async function duplicate() {
    const res = await fetch(`/api/estimates/${id}/duplicate`, { method: 'POST' });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Failed');
    router.push(`/estimates/${(j.estimate as { id: string }).id}`);
  }

  async function convertJob() {
    const res = await fetch(`/api/estimates/${id}/convert-to-job`, { method: 'POST' });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Failed');
    const jobId = (j.job as { id: string }).id;
    await load();
    router.push(`/jobs/${jobId}`);
  }

  if (loading && !data) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
        <div className="p-8 text-center text-gray-500">Loading…</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
        <div className="p-8 text-center">
          <p className="text-red-600">{err || 'Not found'}</p>
          <Link href="/estimates" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
            Back
          </Link>
        </div>
      </div>
    );
  }

  const e = data.estimate;
  const status = String(e.status);

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50 print:bg-white">
      <main className="flex-1 min-h-0 overflow-auto print:overflow-visible">
        <div className="no-print bg-white border-b border-gray-200 px-8 py-4">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/estimates"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              All estimates
            </Link>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => window.open(`/estimate/${e.customer_public_token}`, '_blank')}
              >
                Preview public
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <a
                href={`/api/estimates/${id}/pdf`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
              >
                <FileDown className="w-4 h-4" />
                Download PDF
              </a>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                onClick={async () => {
                  await navigator.clipboard.writeText(data.publicUrl);
                  alert('Link copied');
                }}
              >
                <Copy className="w-4 h-4" />
                Copy link
              </button>
              <button
                type="button"
                onClick={() => load()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-6xl mx-auto space-y-6 print:p-0 print:max-w-none">
      <div className="rounded-xl border border-gray-100 bg-white text-gray-900 shadow-sm p-6 space-y-4 print:shadow-none print:border-gray-300">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-gray-600 font-medium">{String(e.estimate_number)}</p>
            <input
              className="text-2xl font-bold text-gray-950 placeholder:text-gray-400 border-b border-transparent hover:border-gray-200 focus:border-blue-500 outline-none bg-transparent w-full max-w-xl"
              defaultValue={String(e.title)}
              key={e.updated_at as string}
              onBlur={async (ev) => {
                try {
                  await patchEstimate({ title: ev.target.value });
                  await load();
                } catch (x) {
                  alert(x instanceof Error ? x.message : 'Error');
                }
              }}
            />
            <p className="text-sm text-gray-800 mt-1">
              {String(e.customer_name_snapshot)} · {e.customer_phone_snapshot ? String(e.customer_phone_snapshot) : '—'}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-900 capitalize">
              {status}
            </span>
            <p className="text-sm text-gray-700 mt-2">Expires {e.expiration_date ? String(e.expiration_date) : '—'}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 no-print">
          <div>
            <label className="text-xs font-medium text-gray-700">Customer notes (on PDF)</label>
            <textarea
              className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-sm min-h-[72px] text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              defaultValue={(e.notes_customer as string) || ''}
              key={`nc-${e.updated_at}`}
              onBlur={async (ev) => {
                try {
                  await patchEstimate({ notes_customer: ev.target.value || null });
                } catch (x) {
                  alert(x instanceof Error ? x.message : 'Error');
                }
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Internal notes</label>
            <textarea
              className="w-full mt-1 border border-amber-200 rounded-lg p-2 text-sm min-h-[72px] bg-amber-50 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
              defaultValue={(e.notes_internal as string) || ''}
              key={`ni-${e.updated_at}`}
              onBlur={async (ev) => {
                try {
                  await patchEstimate({ notes_internal: ev.target.value || null });
                } catch (x) {
                  alert(x instanceof Error ? x.message : 'Error');
                }
              }}
            />
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between items-center no-print">
            <h2 className="font-semibold text-gray-900">Line items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-gray-900">
              <thead>
                <tr className="text-left text-gray-700 border-b border-gray-200 bg-gray-50/80">
                  <th className="py-2.5 pr-3 font-semibold">Option group</th>
                  <th className="py-2.5 pr-3 font-semibold">Item</th>
                  <th className="py-2.5 pr-3 font-semibold">Qty</th>
                  <th className="py-2.5 pr-3 font-semibold">Unit $</th>
                  <th className="py-2.5 pr-3 font-semibold">Line total</th>
                  <th className="py-2.5 no-print" />
                </tr>
              </thead>
              <tbody>
                {data.lineItems.map((li) => (
                  <tr key={li.id as string} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="py-2 pr-3 text-gray-700 align-top">
                      {status !== 'approved' && status !== 'converted' ? (
                        <input
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-gray-900 bg-white"
                          defaultValue={(li.option_group as string) || ''}
                          placeholder="—"
                          onBlur={(ev) => {
                            const v = ev.target.value.trim();
                            patchLine(li.id as string, { option_group: v || null }).catch((x) =>
                              alert(x instanceof Error ? x.message : 'Error'),
                            );
                          }}
                        />
                      ) : (
                        (li.option_group as string) || '—'
                      )}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-gray-900 align-top">
                      {status !== 'approved' && status !== 'converted' ? (
                        <input
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm font-semibold text-gray-900 bg-white"
                          defaultValue={String(li.name)}
                          onBlur={(ev) => {
                            const v = ev.target.value.trim();
                            if (!v) return;
                            patchLine(li.id as string, { name: v }).catch((x) =>
                              alert(x instanceof Error ? x.message : 'Error'),
                            );
                          }}
                        />
                      ) : (
                        String(li.name)
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-900 align-top">
                      {status !== 'approved' && status !== 'converted' ? (
                        <input
                          type="number"
                          min={0.01}
                          step="any"
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-sm bg-white"
                          defaultValue={Number(li.quantity)}
                          onBlur={(ev) => {
                            const q = parseFloat(ev.target.value);
                            if (!Number.isFinite(q) || q <= 0) return;
                            patchLine(li.id as string, { quantity: q }).catch((x) =>
                              alert(x instanceof Error ? x.message : 'Error'),
                            );
                          }}
                        />
                      ) : (
                        Number(li.quantity)
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-gray-900 align-top">
                      {status !== 'approved' && status !== 'converted' ? (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-24 border border-gray-200 rounded px-2 py-1 text-sm bg-white font-mono"
                          defaultValue={(Number(li.unit_price_cents) / 100).toFixed(2)}
                          onBlur={(ev) => {
                            const dollars = parseFloat(ev.target.value);
                            if (!Number.isFinite(dollars) || dollars < 0) return;
                            patchLine(li.id as string, { unit_price_cents: Math.round(dollars * 100) }).catch((x) =>
                              alert(x instanceof Error ? x.message : 'Error'),
                            );
                          }}
                        />
                      ) : (
                        money(Number(li.unit_price_cents))
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono font-medium tabular-nums text-gray-900">
                      {money(Number(li.total_price_cents))}
                    </td>
                    <td className="py-2 no-print">
                      {status !== 'approved' && status !== 'converted' ? (
                        <button type="button" className="text-red-600" onClick={() => removeLine(li.id as string)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {status !== 'approved' && status !== 'converted' ? (
            <div className="no-print space-y-3 rounded-xl border border-gray-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Quick add from catalog</p>
                <Link
                  href="/crm/service-catalog"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Manage services
                </Link>
              </div>
              {catalogServices.length === 0 ? (
                <p className="text-sm text-gray-700">
                  No catalog services yet.{' '}
                  <Link href="/crm/service-catalog" className="font-medium text-blue-600 hover:underline">
                    Add services
                  </Link>{' '}
                  to use quick add.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-2">
                    {catalogServices.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        title={s.description || undefined}
                        className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-medium text-gray-900 shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900 transition-colors text-left max-w-[240px] leading-snug"
                        onClick={async () => {
                          await fetch(`/api/estimates/${id}/line-items`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              name: s.name,
                              description: s.description || null,
                              quantity: 1,
                              unit: 'ea',
                              unit_price_cents: s.unit_price_cents,
                              category: 'Service',
                            }),
                          });
                          await load();
                        }}
                      >
                        <span className="block">{s.name}</span>
                        <span className="block font-mono text-[11px] text-gray-600 mt-0.5">
                          {money(s.unit_price_cents)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 items-end">
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[120px] text-gray-900 bg-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Custom line name"
                  value={newLine.name}
                  onChange={(ev) => setNewLine((s) => ({ ...s, name: ev.target.value }))}
                />
                <input
                  type="number"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 text-gray-900 bg-white font-mono tabular-nums placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Unit $"
                  value={newLine.unit_price_cents / 100}
                  onChange={(ev) =>
                    setNewLine((s) => ({ ...s, unit_price_cents: Math.round(Number(ev.target.value) * 100) }))
                  }
                />
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 text-gray-900 bg-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Group"
                  value={newLine.option_group}
                  onChange={(ev) => setNewLine((s) => ({ ...s, option_group: ev.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => addLine().catch((x) => alert(x instanceof Error ? x.message : 'Error'))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t pt-4 grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Totals</h3>
            <dl className="text-sm space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-700 font-medium">Subtotal</dt>
                <dd className="font-mono font-medium tabular-nums text-gray-900">{money(Number(e.subtotal_amount_cents))}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-700 font-medium">Discount</dt>
                <dd className="font-mono font-medium tabular-nums text-gray-900">−{money(Number(e.discount_amount_cents))}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-700 font-medium">Tax</dt>
                <dd className="font-mono font-medium tabular-nums text-gray-900">{money(Number(e.tax_amount_cents))}</dd>
              </div>
              <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-300 gap-4">
                <dt className="text-gray-900">Total</dt>
                <dd className="font-mono tabular-nums text-gray-900 text-lg">{money(Number(e.total_amount_cents))}</dd>
              </div>
            </dl>
            {data.payment &&
            (data.payment.depositAmountCents > 0 || data.payment.estimateDepositsEnabled) ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm">
                <h4 className="font-semibold text-amber-950 mb-1">Deposit &amp; online pay</h4>
                <p className="text-amber-900">
                  Deposit:{' '}
                  <span className="font-mono font-medium">{money(data.payment.depositAmountCents)}</span>
                </p>
                <p className="text-amber-900 mt-1">
                  Status:{' '}
                  <span className="font-medium capitalize">{String(e.deposit_status || data.payment.depositStatus)}</span>
                </p>
                {!data.payment.stripeSecretConfigured ? (
                  <p className="text-amber-800 text-xs mt-2">Stripe is not configured (server env).</p>
                ) : null}
                {data.payment.onlinePaymentsEnabled && data.payment.estimateDepositsEnabled ? (
                  <p className="text-amber-800 text-xs mt-2">
                    Customer pays on the public link below when the estimate is sent.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3 no-print flex flex-wrap gap-2 items-center">
              <label className="text-xs font-medium text-gray-700">Discount (cents)</label>
              <input
                type="number"
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-28 text-gray-900 bg-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                defaultValue={Number(e.discount_amount_cents)}
                key={`disc-${e.updated_at}`}
                onBlur={async (ev) => {
                  try {
                    await patchEstimate({ discount_amount_cents: Math.max(0, parseInt(ev.target.value, 10) || 0) });
                    await load();
                  } catch (x) {
                    alert(x instanceof Error ? x.message : 'Error');
                  }
                }}
              />
              <label className="text-xs font-medium text-gray-700 ml-2">Tax bps</label>
              <input
                type="number"
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-24 text-gray-900 bg-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                defaultValue={e.tax_rate_basis_points != null ? Number(e.tax_rate_basis_points) : ''}
                key={`tax-${e.updated_at}`}
                onBlur={async (ev) => {
                  try {
                    const v = ev.target.value.trim();
                    await patchEstimate({ tax_rate_basis_points: v === '' ? null : Math.max(0, parseInt(v, 10) || 0) });
                    await load();
                  } catch (x) {
                    alert(x instanceof Error ? x.message : 'Error');
                  }
                }}
              />
            </div>
          </div>
          <div className="no-print space-y-2">
            <h3 className="font-semibold text-gray-900">Email draft</h3>
            <p className="text-xs text-gray-600">
              Customer and email come from the linked CRM record at estimate creation. Edit below before sending.
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium text-gray-600">To</label>
                <input
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white"
                  value={sendEmail}
                  onChange={(ev) => setSendEmail(ev.target.value)}
                  placeholder="customer@email.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Subject</label>
                <input
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white"
                  value={emailSubject}
                  onChange={(ev) => setEmailSubject(ev.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Body</label>
                <textarea
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 bg-white min-h-[180px] font-sans"
                  value={emailBody}
                  onChange={(ev) => setEmailBody(ev.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={status === 'converted'}
                onClick={() => send().catch((x) => alert(x instanceof Error ? x.message : 'Error'))}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                Send email
              </button>
              <button
                type="button"
                onClick={() => duplicate().catch((x) => alert(x instanceof Error ? x.message : 'Error'))}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
              >
                Duplicate
              </button>
              <button
                type="button"
                disabled={status !== 'approved'}
                onClick={() => convertJob().catch((x) => alert(x instanceof Error ? x.message : 'Error'))}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                <Briefcase className="w-4 h-4" />
                Convert to job
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
                onClick={() =>
                  fetch(`/api/estimates/${id}/approve-manually`, { method: 'POST' }).then(load).catch((x) => alert(String(x)))
                }
              >
                Mark approved (office)
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
                onClick={() =>
                  fetch(`/api/estimates/${id}/reject-manually`, { method: 'POST' }).then(load).catch((x) => alert(String(x)))
                }
              >
                Mark rejected (office)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 no-print">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Activity</h3>
          <ul className="text-sm space-y-2 border border-gray-200 rounded-xl p-3 bg-white max-h-64 overflow-y-auto shadow-sm">
            {activity.map((a) => (
              <li key={a.id as string} className="text-gray-800">
                <span className="font-semibold text-gray-900">{String(a.event_type)}</span>
                <span className="text-gray-600 text-xs ml-2 font-mono">{String(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Deliveries</h3>
          <ul className="text-sm space-y-2 border border-gray-200 rounded-xl p-3 bg-white max-h-64 overflow-y-auto shadow-sm">
            {deliveries.length === 0 ? <li className="text-gray-600 font-medium">None yet</li> : null}
            {deliveries.map((d) => (
              <li key={d.id as string} className="text-gray-800">
                {String(d.delivery_type)} · {String(d.status)} · {String(d.created_at)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="text-xs text-gray-500 no-print pb-4 flex flex-wrap gap-x-4 gap-y-1">
        {e.lead_id ? (
          <Link className="text-blue-600 hover:text-blue-700 hover:underline" href={`/leads/${e.lead_id}`}>
            Lead detail
          </Link>
        ) : null}
        {e.customer_id ? (
          <Link className="text-blue-600 hover:text-blue-700 hover:underline" href={`/customers/${e.customer_id}`}>
            Customer detail
          </Link>
        ) : null}
        {e.converted_to_job_id ? (
          <Link className="text-blue-600 hover:text-blue-700 hover:underline" href={`/jobs/${e.converted_to_job_id}`}>
            Converted job
          </Link>
        ) : null}
        {e.job_id ? (
          <Link className="text-blue-600 hover:text-blue-700 hover:underline" href={`/jobs/${e.job_id}`}>
            Linked job
          </Link>
        ) : null}
        {e.receptionist_call_id ? (
          <Link
            className="text-blue-600 hover:text-blue-700 hover:underline"
            href={`/receptionist/${e.receptionist_call_id}`}
          >
            Receptionist call
          </Link>
        ) : null}
      </div>
        </div>
      </main>
    </div>
  );
}
