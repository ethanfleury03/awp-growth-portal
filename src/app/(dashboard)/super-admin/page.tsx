'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Loader2, Plus, Search, Settings2, Users, X } from 'lucide-react';
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
  stripe_connect_status: string | null;
  user_count: number;
  enabled_module_count: number;
  invoice_count: number;
  paid_cents: number;
  last_activity_at: string | null;
  audit_event_count: number;
  last_lead_at: string | null;
  last_user_activity_at: string | null;
};

type Summary = {
  total_tenants?: number;
  active_users?: number;
  recent_activity?: number;
  average_enabled_modules?: number;
};

type UnassignedUser = {
  email: string;
  name: string | null;
  clerk_user_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

const defaultModules = MODULE_CATALOG.filter((m) => m.defaultEnabled).map((m) => m.key);

function fmtMoney(cents: number | null | undefined) {
  return `$${((Number(cents) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'No activity';
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SuperAdminHome() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [unassignedUsers, setUnassignedUsers] = useState<UnassignedUser[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignForms, setAssignForms] = useState<Record<string, { companyId: string; role: string }>>({});
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

  const averageModules = Number(summary.average_enabled_modules || 0);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants?q=${encodeURIComponent(q)}`, {
        cache: 'no-store',
      });
      const unassignedRes = await fetch('/api/admin/unassigned-users', { cache: 'no-store' });
      const json = await res.json();
      const unassignedJson = await unassignedRes.json();
      if (!res.ok) throw new Error(json.error || 'Could not load tenants.');
      setTenants(json.tenants || []);
      setSummary(json.summary || {});
      if (unassignedRes.ok) setUnassignedUsers(unassignedJson.users || []);
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not load tenants.' });
    } finally {
      setLoading(false);
    }
  }

  async function assignUnassigned(email: string) {
    const form = assignForms[email];
    if (!form?.companyId) {
      setNotice({ type: 'error', text: 'Choose a tenant before assigning this user.' });
      return;
    }
    setAssigning(email);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/unassigned-users/${encodeURIComponent(email)}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not assign user.');
      setNotice({ type: 'success', text: `${email} assigned.` });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not assign user.' });
    } finally {
      setAssigning(null);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function validateForm() {
    if (!form.name.trim()) return 'Company name is required.';
    if (!form.email.trim()) return 'Contact email is required.';
    if (!validEmail(form.email.trim())) return 'Enter a valid contact email.';
    if (form.adminEmail.trim() && !validEmail(form.adminEmail.trim())) return 'Enter a valid first admin email.';
    return null;
  }

  async function createTenant() {
    const validation = validateForm();
    if (validation) {
      setNotice({ type: 'error', text: validation });
      return;
    }
    setCreating(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, preset: form.industry }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not create tenant.');
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
      setPanelOpen(false);
      setNotice({ type: 'success', text: 'Tenant created.' });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not create tenant.' });
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
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6">
      <header className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur lg:-mx-6 lg:-mt-6 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Super admin</h1>
            <p className="text-sm text-slate-600">Create and manage client CRM workspaces for WNY Automation.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/super-admin/webhook-failures"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <AlertCircle className="h-4 w-4" /> Webhook failures
            </Link>
            <button
              onClick={() => setPanelOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" /> Create tenant
            </button>
          </div>
        </div>
      </header>

      {notice ? (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
          notice.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {notice.text}
        </div>
      ) : null}

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Settings2} label="Total tenants" value={Number(summary.total_tenants || tenants.length).toLocaleString()} />
        <Metric icon={Users} label="Active users" value={Number(summary.active_users || 0).toLocaleString()} />
        <Metric icon={Activity} label="Audit events" value={Number(summary.recent_activity || 0).toLocaleString()} />
        <Metric icon={Settings2} label="Avg modules" value={averageModules.toFixed(1)} />
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="w-full text-sm outline-none"
              placeholder="Search tenants by company or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
          <div className="text-xs font-medium text-slate-500">{tenants.length} shown</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3 text-right">Users</th>
                <th className="px-4 py-3 text-right">Modules</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3">Last Activity</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && !tenants.length ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-4 py-4" colSpan={8}>
                      <div className="h-8 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : tenants.length ? (
                tenants.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{t.display_name || t.name}</div>
                      <div className="text-xs text-slate-500">{t.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        {t.stripe_connect_status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{t.industry || 'generic'}</td>
                    <td className="px-4 py-3 text-right">{Number(t.user_count || 0)}</td>
                    <td className="px-4 py-3 text-right">{Number(t.enabled_module_count || 0)}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtMoney(t.paid_cents)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(t.last_activity_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/super-admin/tenants/${t.id}`} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={8}>
                    No tenants found. Create the first client CRM when ready.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Unassigned users</h2>
            <p className="mt-1 text-sm text-slate-600">People who signed in but are not connected to a client workspace yet.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{unassignedUsers.length}</span>
        </div>
        {unassignedUsers.length ? (
          <div className="divide-y divide-slate-100">
            {unassignedUsers.map((user) => {
              const form = assignForms[user.email] || { companyId: tenants[0]?.id || '', role: 'staff' };
              return (
                <div key={user.email} className="grid gap-3 p-4 lg:grid-cols-[1fr_16rem_9rem_7rem] lg:items-center">
                  <div>
                    <div className="font-medium text-slate-950">{user.name || user.email}</div>
                    <div className="text-xs text-slate-500">{user.email} - last seen {fmtDate(user.last_seen_at)}</div>
                  </div>
                  <select
                    value={form.companyId}
                    onChange={(e) => setAssignForms((forms) => ({ ...forms, [user.email]: { ...form, companyId: e.target.value } }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Choose tenant</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.display_name || tenant.name}</option>
                    ))}
                  </select>
                  <select
                    value={form.role}
                    onChange={(e) => setAssignForms((forms) => ({ ...forms, [user.email]: { ...form, role: e.target.value } }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {['admin', 'dispatcher', 'staff', 'tech', 'viewer'].map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignUnassigned(user.email)}
                    disabled={assigning === user.email}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {assigning === user.email ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Assign
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500">No unassigned users waiting right now.</div>
        )}
      </section>

      {panelOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/30">
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Create client CRM</h2>
                <p className="text-sm text-slate-500">Set the starting modules, branding seed, and first admin.</p>
              </div>
              <button onClick={() => setPanelOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Company name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
                <Field label="Contact email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Industry preset</span>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.industry} onChange={(e) => applyPresetModules(e.target.value)}>
                    {INDUSTRY_PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </label>
                <Field label="Timezone" value={form.timezone} onChange={(v) => setForm((f) => ({ ...f, timezone: v }))} />
                <Field label="First admin email" value={form.adminEmail} onChange={(v) => setForm((f) => ({ ...f, adminEmail: v }))} />
                <Field label="First admin name" value={form.adminName} onChange={(v) => setForm((f) => ({ ...f, adminName: v }))} />
              </div>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-950">Initial modules</h3>
                  <span className="text-xs text-slate-500">Preset: {preset.label}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {MODULE_CATALOG.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => toggleModule(m.key)}
                      className={`rounded-lg border p-3 text-left text-sm ${
                        form.modules.includes(m.key)
                          ? 'border-orange-300 bg-orange-50 text-orange-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="font-medium">{m.label}</span>
                      <span className="mt-1 block text-xs opacity-75">{m.description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <button
                onClick={createTenant}
                disabled={creating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create tenant
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Settings2; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}{required ? ' *' : ''}</span>
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
