'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Pencil, Plus, Search, Trash2, Wrench } from 'lucide-react';

type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  unit_price_cents: number;
  updated_at?: string;
};

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function centsFromDollarsInput(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function dollarsFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function ServiceCatalogPage() {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<CatalogService | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/estimates/catalog-services');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load');
      setServices((j.services as CatalogService[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = services.filter((s) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  });

  function openAdd() {
    setEditing(null);
    setFormName('');
    setFormDesc('');
    setFormPrice('');
    setError('');
    setModal('add');
  }

  function openEdit(s: CatalogService) {
    setEditing(s);
    setFormName(s.name);
    setFormDesc(s.description || '');
    setFormPrice(dollarsFromCents(s.unit_price_cents));
    setError('');
    setModal('edit');
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const cents = centsFromDollarsInput(formPrice);
    if (!formName.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (modal === 'add') {
        const res = await fetch('/api/estimates/catalog-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim() || null,
            unit_price_cents: cents,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed');
      } else if (modal === 'edit' && editing) {
        const res = await fetch(`/api/estimates/catalog-services/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim() || null,
            unit_price_cents: cents,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed');
      }
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this service from the catalog?')) return;
    const res = await fetch(`/api/estimates/catalog-services/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || 'Delete failed');
      return;
    }
    await load();
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 min-h-0 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-blue-50 p-2">
                <Wrench className="h-6 w-6 text-blue-600" aria-hidden />
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Link href="/crm" className="hover:text-blue-600">
                    CRM
                  </Link>
                  <span>/</span>
                  <span className="text-gray-700">Service catalog</span>
                </div>
                <h1 className="text-2xl font-semibold text-gray-900 mt-1">Service catalog</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  Reusable services with description and default price. Attach them when building estimates.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full sm:w-64 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Link
                href="/estimates/new"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                New estimate
                <ChevronRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
              >
                <Plus className="w-4 h-4" />
                Add service
              </button>
            </div>
          </div>
        </header>

        <div className="p-8">
          {error && !modal ? (
            <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
          ) : null}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500 text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                {services.length === 0
                  ? 'No services yet. Add your first service to use it on estimates.'
                  : 'No matches. Try a different search.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Name</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Description</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Default price</th>
                      <th className="px-6 py-3 w-32" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/80">
                        <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                        <td className="px-6 py-4 text-gray-600 max-w-md">
                          {s.description ? (
                            <span className="line-clamp-2 whitespace-pre-wrap">{s.description}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-900">{money(s.unit_price_cents)}</td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium mr-1"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(s.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-500 bg-gray-50/50">
              {filtered.length} of {services.length} services
            </div>
          </div>
        </div>
      </main>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {modal === 'add' ? 'Add service' : 'Edit service'}
            </h2>
            <form onSubmit={submitForm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Default price (USD)</label>
                <input
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModal(null);
                    setError('');
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
