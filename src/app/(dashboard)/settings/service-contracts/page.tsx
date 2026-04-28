'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Power, Trash2 } from 'lucide-react';

type Contract = {
  id: string;
  name: string;
  cadence: string;
  price_cents: number;
  active: number | boolean;
  next_due_at: string | null;
  notes: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
};

type Customer = { id: string; name: string | null; phone: string | null };

const CADENCES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual'];

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ServiceContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    name: '',
    cadence: 'monthly',
    priceDollars: '',
    nextDueAt: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cust] = await Promise.all([
        fetch('/api/service-contracts', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/customers', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      setContracts(c.contracts || []);
      setCustomers(cust.customers || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!form.customerId || !form.name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/service-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          name: form.name,
          cadence: form.cadence,
          priceCents: Math.round(Number(form.priceDollars || '0') * 100),
          nextDueAt: form.nextDueAt || null,
          notes: form.notes || null,
        }),
      });
      if (res.ok) {
        setForm({ customerId: '', name: '', cadence: 'monthly', priceDollars: '', nextDueAt: '', notes: '' });
        await load();
      } else {
        const { error } = await res.json();
        alert(error || 'Failed to create');
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(contract: Contract) {
    const active = !(contract.active === 1 || contract.active === true);
    await fetch(`/api/service-contracts/${contract.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    await load();
  }

  async function remove(contract: Contract) {
    if (!confirm(`Delete contract "${contract.name}"?`)) return;
    await fetch(`/api/service-contracts/${contract.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="p-6 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Service Contracts</h1>
        <p className="text-sm text-muted-foreground">
          Recurring maintenance agreements. Schedule reminders will be generated from the next-due date.
        </p>
      </header>

      <section className="mb-8 rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Plus className="size-4" /> New contract
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-gray-700 mb-1">Customer</span>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="w-full rounded border px-2 py-1"
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.phone || c.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 mb-1">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Annual water heater flush"
              className="w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 mb-1">Cadence</span>
            <select
              value={form.cadence}
              onChange={(e) => setForm({ ...form, cadence: e.target.value })}
              className="w-full rounded border px-2 py-1"
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 mb-1">Price (USD)</span>
            <input
              type="number"
              step="0.01"
              value={form.priceDollars}
              onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
              className="w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 mb-1">Next due</span>
            <input
              type="date"
              value={form.nextDueAt}
              onChange={(e) => setForm({ ...form, nextDueAt: e.target.value })}
              className="w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="block text-gray-700 mb-1">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded border px-2 py-1"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={submit}
            disabled={creating || !form.customerId || !form.name}
            className="inline-flex items-center gap-2 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Existing contracts</h2>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No contracts yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Cadence</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Next due</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">{c.customer_name || c.customer_phone || '—'}</td>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 capitalize">{c.cadence}</td>
                  <td className="px-4 py-2">{fmtMoney(c.price_cents)}</td>
                  <td className="px-4 py-2">{c.next_due_at ? c.next_due_at.slice(0, 10) : '—'}</td>
                  <td className="px-4 py-2">
                    {c.active === 1 || c.active === true ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Active</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Paused</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => toggleActive(c)}
                      className="mr-2 inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      <Power className="size-3" />
                      {c.active === 1 || c.active === true ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
