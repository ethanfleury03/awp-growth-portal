'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { INDUSTRY_PRESETS } from '@/lib/modules/presets';
import { MODULE_CATALOG, type ModuleKey } from '@/lib/modules/catalog';

type Tenant = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  display_name: string | null;
  industry: string | null;
  portal_title: string | null;
  created_at: string;
  user_count: number;
  enabled_module_count: number;
  invoice_count: number;
  paid_cents: number;
  last_activity_at: string | null;
};

const defaultModules = MODULE_CATALOG.filter((m) => m.defaultEnabled).map((m) => m.key);

function fmtMoney(cents: number | null | undefined) {
  return `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SuperAdminHome() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    industry: 'generic',
    timezone: 'America/New_York',
    adminEmail: '',
    adminName: '',
    modules: defaultModules as ModuleKey[],
  });

  const preset = useMemo(
    () => INDUSTRY_PRESETS.find((p) => p.key === form.industry) ?? INDUSTRY_PRESETS[0],
    [form.industry],
  );

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants?q=${encodeURIComponent(q)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      setTenants(json.tenants || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function createTenant() {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, preset: form.industry }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not create tenant');
      setForm({
        name: '',
        email: '',
        phone: '',
        industry: 'generic',
        timezone: 'America/New_York',
        adminEmail: '',
        adminName: '',
        modules: defaultModules,
      });
      await load();
    } finally {
      setCreating(false);
    }
  }

  function toggleModule(key: ModuleKey) {
    setForm((f) => ({
      ...f,
      modules: f.modules.includes(key)
        ? f.modules.filter((m) => m !== key)
        : [...f.modules, key],
    }));
  }

  function applyPresetModules(nextIndustry: string) {
    const nextPreset = INDUSTRY_PRESETS.find((p) => p.key === nextIndustry) ?? INDUSTRY_PRESETS[0];
    setForm((f) => ({ ...f, industry: nextIndustry, modules: nextPreset.modules }));
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Super admin</h1>
          <p className="text-sm text-slate-600">
            Create client workspaces, assign users, enable modules, and manage CRM presets.
          </p>
        </div>
        <Link
          href="/super-admin/webhook-failures"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Webhook failures
        </Link>
      </header>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-orange-600" />
          <h2 className="font-semibold text-slate-950">Create client CRM</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Company name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Billing/contact email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.industry} onChange={(e) => applyPresetModules(e.target.value)}>
            {INDUSTRY_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Timezone" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="First admin email optional" value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="First admin name optional" value={form.adminName} onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))} />
          <button
            onClick={createTenant}
            disabled={creating || !form.name || !form.email}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create tenant'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {MODULE_CATALOG.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => toggleModule(m.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                form.modules.includes(m.key)
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
              title={m.description}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Preset: {preset.label}. You can adjust modules before creating.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            className="w-full text-sm outline-none"
            placeholder="Search tenants"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3 text-right">Users</th>
                <th className="px-4 py-3 text-right">Modules</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3">Last Activity</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-950">{t.display_name || t.name}</div>
                    <div className="text-xs text-slate-500">{t.email}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{t.industry || 'generic'}</td>
                  <td className="px-4 py-3 text-right">{t.user_count}</td>
                  <td className="px-4 py-3 text-right">{t.enabled_module_count}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmtMoney(t.paid_cents)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {t.last_activity_at ? new Date(t.last_activity_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/super-admin/tenants/${t.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
