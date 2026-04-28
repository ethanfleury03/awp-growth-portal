'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Trash2, User, X } from 'lucide-react';
import { calculateEstimateTotals } from '@/lib/estimates/totals';

type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  unit_price_cents: number;
};

type CrmCustomer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

type DraftLine = {
  key: string;
  catalog_service_id: string | null;
  name: string;
  description: string;
  quantity: number;
  unitPriceDisplay: string;
};

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function parseDollarsToCents(s: string): number {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function newRow(): DraftLine {
  return {
    key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    catalog_service_id: null,
    name: '',
    description: '',
    quantity: 1,
    unitPriceDisplay: '',
  };
}

function NewEstimateForm() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [title, setTitle] = useState('Plumbing estimate');
  const [rows, setRows] = useState<DraftLine[]>([newRow()]);
  const [estimateDiscountDisplay, setEstimateDiscountDisplay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [settings, setSettings] = useState<{
    company_name: string;
    default_tax_rate_basis_points: number | null;
  } | null>(null);

  const leadId = sp.get('lead_id');
  const customerId = sp.get('customer_id');
  const jobId = sp.get('job_id');
  const callId = sp.get('receptionist_call_id');

  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CrmCustomer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);

  const setCustomerInUrl = useCallback(
    (id: string | null) => {
      const p = new URLSearchParams(sp.toString());
      if (id) p.set('customer_id', id);
      else p.delete('customer_id');
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, sp],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim()), 280);
    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    if (!customerId) {
      setSelectedCustomer(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customers/${customerId}`);
        const j = await res.json();
        if (cancelled || !j.customer) return;
        const c = j.customer as Record<string, unknown>;
        setSelectedCustomer({
          id: String(c.id),
          name: String(c.name || ''),
          email: (c.email as string) || null,
          phone: (c.phone as string) || null,
        });
      } catch {
        if (!cancelled) setSelectedCustomer(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    if (!debouncedCustomerSearch) {
      setCustomerResults([]);
      return;
    }
    let cancelled = false;
    setCustomerSearchLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/customers?search=${encodeURIComponent(debouncedCustomerSearch)}&limit=40`,
        );
        const j = await res.json();
        if (cancelled) return;
        const list = (j.customers as Record<string, unknown>[]) || [];
        setCustomerResults(
          list.map((c) => ({
            id: String(c.id),
            name: String(c.name || ''),
            email: (c.email as string) || null,
            phone: (c.phone as string) || null,
          })),
        );
      } finally {
        if (!cancelled) setCustomerSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedCustomerSearch]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([fetch('/api/estimates/catalog-services'), fetch('/api/estimates/settings')]);
      const cj = await cRes.json();
      const sj = await sRes.json();
      setCatalog((cj.services as CatalogService[]) || []);
      if (sj.settings) {
        setSettings({
          company_name: String(sj.settings.company_name || 'Company'),
          default_tax_rate_basis_points:
            sj.settings.default_tax_rate_basis_points == null
              ? null
              : Number(sj.settings.default_tax_rate_basis_points),
        });
      }
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const catalogById = useMemo(() => new Map(catalog.map((s) => [s.id, s])), [catalog]);

  const discountCents = parseDollarsToCents(estimateDiscountDisplay);

  const previewTotals = useMemo(() => {
    const lines = rows
      .filter((r) => r.name.trim() !== '')
      .map((r) => ({
        quantity: Math.max(0.0001, Number(r.quantity) || 1),
        unit_price_cents: parseDollarsToCents(r.unitPriceDisplay),
        is_taxable: true as const,
      }));
    return calculateEstimateTotals({
      lines,
      discount_amount_cents: discountCents,
      tax_rate_basis_points: settings?.default_tax_rate_basis_points ?? null,
    });
  }, [rows, discountCents, settings]);

  const contextParts: string[] = [];
  if (leadId) contextParts.push(`Lead in URL — ${leadId.slice(0, 8)}…`);
  if (selectedCustomer) {
    contextParts.push(`Customer: ${selectedCustomer.name}.`);
  } else if (customerId) {
    contextParts.push('Customer from URL — loading…');
  }
  if (jobId) contextParts.push(`Job in URL — ${jobId.slice(0, 8)}…`);
  if (callId) contextParts.push(`Receptionist call — ${callId.slice(0, 8)}…`);
  const contextLine =
    contextParts.length > 0
      ? contextParts.join(' ')
      : 'Pick a CRM customer (below) or open from a lead/job link — snapshots are set when you create.';

  function applyCatalogToRow(key: string, serviceId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        if (!serviceId) {
          return { ...r, catalog_service_id: null };
        }
        const s = catalogById.get(serviceId);
        if (!s) return { ...r, catalog_service_id: null };
        return {
          ...r,
          catalog_service_id: s.id,
          name: s.name,
          description: s.description || '',
          unitPriceDisplay: (s.unit_price_cents / 100).toFixed(2),
        };
      }),
    );
  }

  async function submit() {
    setErr('');
    const initial_line_items = rows
      .filter((r) => r.name.trim() !== '')
      .map((r) => ({
        catalog_service_id: r.catalog_service_id,
        name: r.name.trim(),
        description: r.description.trim() || null,
        quantity: Math.max(0.0001, Number(r.quantity) || 1),
        unit: 'ea',
        unit_price_cents: parseDollarsToCents(r.unitPriceDisplay),
        is_taxable: true,
      }));

    setSubmitting(true);
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          lead_id: leadId || null,
          customer_id: selectedCustomer?.id ?? customerId ?? null,
          job_id: jobId || null,
          receptionist_call_id: callId || null,
          source_type: leadId ? 'lead' : customerId ? 'customer' : jobId ? 'job' : callId ? 'receptionist_call' : 'manual',
          source_id: leadId || customerId || jobId || callId || null,
          discount_amount_cents: discountCents,
          initial_line_items: initial_line_items.length ? initial_line_items : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      router.push(`/estimates/${(data.estimate as { id: string }).id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  const previewRows = rows.filter((r) => r.name.trim() !== '');

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 min-h-0 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <Link
            href="/estimates"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to estimates
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 mt-3">New estimate</h1>
          <p className="text-gray-500 text-sm mt-1">{contextLine}</p>
          <p className="text-sm mt-2">
            <Link href="/crm/service-catalog" className="text-blue-600 hover:underline font-medium">
              Manage service catalog
            </Link>
            <span className="text-gray-500"> — add or edit reusable services and default prices.</span>
          </p>
        </header>

        <div className="p-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-8 items-start">
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estimate title</label>
                  <input
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Line items</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Pick a catalog service to fill name and price, then adjust as needed. Or choose “Custom” and
                        type your own.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRows((r) => [...r, newRow()])}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Add line
                    </button>
                  </div>

                  {catalogLoading ? (
                    <p className="text-sm text-gray-500 mt-4">Loading catalog…</p>
                  ) : catalog.length === 0 ? (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-4">
                      No catalog services yet.{' '}
                      <Link href="/crm/service-catalog" className="font-medium text-blue-700 hover:underline">
                        Create services in the catalog
                      </Link>{' '}
                      first, or use custom lines only.
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-4">
                    {rows.map((row, idx) => (
                      <div
                        key={row.key}
                        className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Line {idx + 1}</span>
                          {rows.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                              className="text-red-600 hover:bg-red-50 p-1 rounded"
                              aria-label="Remove line"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Catalog service</label>
                          <select
                            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={row.catalog_service_id || ''}
                            onChange={(e) => applyCatalogToRow(row.key, e.target.value)}
                          >
                            <option value="">Custom line (manual entry)</option>
                            {catalog.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} — {money(s.unit_price_cents)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600">Name / title</label>
                            <input
                              value={row.name}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key ? { ...r, name: e.target.value, catalog_service_id: null } : r,
                                  ),
                                )
                              }
                              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                              placeholder="Service name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600">Qty</label>
                            <input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={row.quantity}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key ? { ...r, quantity: parseFloat(e.target.value) || 1 } : r,
                                  ),
                                )
                              }
                              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Description (optional)</label>
                          <textarea
                            value={row.description}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key ? { ...r, description: e.target.value, catalog_service_id: null } : r,
                                ),
                              )
                            }
                            rows={2}
                            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                            placeholder="Details shown on the estimate"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Unit price (USD)</label>
                          <input
                            value={row.unitPriceDisplay}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key
                                    ? { ...r, unitPriceDisplay: e.target.value, catalog_service_id: null }
                                    : r,
                                ),
                              )
                            }
                            className="mt-1 w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <label className="block text-sm font-medium text-gray-700">Estimate discount (USD)</label>
                  <p className="text-xs text-gray-500 mt-0.5">Applied before tax on the estimate total.</p>
                  <input
                    value={estimateDiscountDisplay}
                    onChange={(e) => setEstimateDiscountDisplay(e.target.value)}
                    className="mt-2 w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono"
                    placeholder="0.00"
                  />
                </div>

                {err ? <p className="text-sm text-red-600">{err}</p> : null}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="px-5 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create & edit'}
                </button>
              </div>
            </div>

            <aside className="lg:sticky lg:top-6 space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Live preview</p>
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-800 text-white px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Estimate preview</p>
                  <p className="font-semibold text-sm mt-0.5">{settings?.company_name || 'Your company'}</p>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase">Title</p>
                    <p className="font-semibold text-gray-900 leading-snug">{title || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase mb-2">Lines</p>
                    {previewRows.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Add at least one named line with a price.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {previewRows.map((r) => {
                          const lineTotal = Math.round((Number(r.quantity) || 1) * parseDollarsToCents(r.unitPriceDisplay));
                          return (
                            <li key={r.key} className="border-b border-gray-100 pb-2 last:border-0">
                              <div className="flex justify-between gap-2">
                                <span className="text-gray-800 font-medium min-w-0">{r.name}</span>
                                <span className="font-mono text-gray-900 shrink-0">{money(lineTotal)}</span>
                              </div>
                              {r.description ? (
                                <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{r.description}</p>
                              ) : null}
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {Number(r.quantity) || 1} × {money(parseDollarsToCents(r.unitPriceDisplay))}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span className="font-mono">{money(previewTotals.subtotal_amount_cents)}</span>
                    </div>
                    {discountCents > 0 ? (
                      <div className="flex justify-between text-gray-600">
                        <span>Discount</span>
                        <span className="font-mono">−{money(discountCents)}</span>
                      </div>
                    ) : null}
                    {previewTotals.tax_amount_cents > 0 ? (
                      <div className="flex justify-between text-gray-600">
                        <span>Tax</span>
                        <span className="font-mono">{money(previewTotals.tax_amount_cents)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-semibold text-base text-gray-900 pt-1">
                      <span>Total</span>
                      <span className="font-mono">{money(previewTotals.total_amount_cents)}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Tax uses your default rate from Estimate defaults. You can fine-tune everything after create.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-gray-900">
                    <User className="w-4 h-4 text-gray-500 shrink-0" />
                    <h2 className="text-sm font-semibold">Customer (CRM)</h2>
                  </div>
                  <Link href="/customers" className="text-xs text-blue-600 hover:underline shrink-0">
                    Directory
                  </Link>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Who is this estimate for? Search your customers — name, email, and phone are copied onto the
                  estimate for sending.
                </p>
                {selectedCustomer ? (
                  <div className="rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2 text-sm">
                    <div className="flex justify-between gap-2 items-start">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{selectedCustomer.name}</p>
                        {selectedCustomer.email ? (
                          <p className="text-xs text-gray-700 truncate">{selectedCustomer.email}</p>
                        ) : (
                          <p className="text-xs text-amber-800">No email on file — add on customer or when editing.</p>
                        )}
                        {selectedCustomer.phone ? (
                          <p className="text-xs text-gray-600">{selectedCustomer.phone}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerInUrl(null);
                          setCustomerSearch('');
                          setCustomerResults([]);
                        }}
                        className="p-1 rounded-md text-gray-500 hover:bg-white hover:text-gray-800"
                        aria-label="Clear customer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
                <div>
                  <label className="text-xs font-medium text-gray-600">Search customers</label>
                  <input
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                    placeholder="Name, phone, or email…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>
                {customerSearchLoading ? (
                  <p className="text-xs text-gray-500">Searching…</p>
                ) : customerResults.length > 0 ? (
                  <ul className="max-h-44 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-100 text-sm">
                    {customerResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 transition"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerInUrl(c.id);
                            setCustomerSearch('');
                            setCustomerResults([]);
                          }}
                        >
                          <span className="font-medium text-gray-900 block truncate">{c.name}</span>
                          <span className="text-xs text-gray-600 block truncate">
                            {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : debouncedCustomerSearch ? (
                  <p className="text-xs text-gray-500">No matches.</p>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NewEstimatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
          <div className="p-8 text-sm text-gray-500">Loading…</div>
        </div>
      }
    >
      <NewEstimateForm />
    </Suspense>
  );
}
