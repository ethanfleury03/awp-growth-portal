'use client';

import Link from 'next/link';
import type { ComponentType, Dispatch, ReactNode, SetStateAction } from 'react';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Loader2,
  Palette,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { INDUSTRY_PRESETS } from '@/lib/modules/presets';
import { MODULE_CATALOG, type ModuleKey } from '@/lib/modules/catalog';

type TabKey = 'overview' | 'users' | 'modules' | 'branding' | 'crm' | 'integrations' | 'audit';

type Tenant = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  display_name: string | null;
  legal_name: string | null;
  industry: string | null;
  timezone: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  portal_title: string | null;
  workspace_label: string | null;
  default_route: string | null;
  created_at: string;
};

type TenantUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean | number;
  clerk_user_id: string | null;
  updated_at: string | null;
};

type CustomField = {
  id?: string;
  entity_type?: string;
  entityType?: string;
  field_key?: string;
  fieldKey?: string;
  label: string;
  field_type?: string;
  fieldType?: string;
  required?: boolean | number;
  options_json?: string | null;
  options?: string[];
  sort_order?: number;
  sortOrder?: number;
  is_active?: boolean | number;
  isActive?: boolean;
};

type PipelineStage = {
  id?: string;
  entity_type?: string;
  entityType?: string;
  stage_key?: string;
  stageKey?: string;
  label: string;
  color?: string;
  sort_order?: number;
  sortOrder?: number;
  is_active?: boolean | number;
  isActive?: boolean;
};

type AuditEvent = {
  id: string;
  action: string;
  entity_type: string | null;
  summary: string | null;
  actor_email: string | null;
  created_at: string;
};

const tabs: { key: TabKey; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Overview', icon: ClipboardList },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'modules', label: 'Modules', icon: SlidersHorizontal },
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'crm', label: 'CRM Setup', icon: Settings2 },
  { key: 'integrations', label: 'Integrations', icon: ShieldCheck },
  { key: 'audit', label: 'Audit', icon: ClipboardList },
];

const roles = ['admin', 'dispatcher', 'staff', 'tech', 'viewer'];

function active(value: boolean | number | undefined) {
  return value === true || value === 1 || value === undefined;
}

function normalizeField(field: CustomField): CustomField {
  let options = field.options;
  if (!options && field.options_json) {
    try {
      options = JSON.parse(field.options_json);
    } catch {
      options = [];
    }
  }
  return {
    entityType: field.entityType ?? field.entity_type ?? 'lead',
    fieldKey: field.fieldKey ?? field.field_key ?? '',
    label: field.label,
    fieldType: field.fieldType ?? field.field_type ?? 'text',
    required: field.required === true || field.required === 1,
    options,
    sortOrder: field.sortOrder ?? field.sort_order ?? 0,
    isActive: active(field.isActive ?? field.is_active),
  };
}

function normalizeStage(stage: PipelineStage): PipelineStage {
  return {
    entityType: stage.entityType ?? stage.entity_type ?? 'lead',
    stageKey: stage.stageKey ?? stage.stage_key ?? '',
    label: stage.label,
    color: stage.color ?? '#2563eb',
    sortOrder: stage.sortOrder ?? stage.sort_order ?? 0,
    isActive: active(stage.isActive ?? stage.is_active),
  };
}

export default function SuperAdminTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [enabledModules, setEnabledModules] = useState<ModuleKey[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [userForm, setUserForm] = useState({ email: '', name: '', role: 'staff' });
  const [branding, setBranding] = useState({
    displayName: '',
    legalName: '',
    industry: 'generic',
    timezone: 'America/New_York',
    logoUrl: '',
    primaryColor: '#ea580c',
    accentColor: '#2563eb',
    portalTitle: 'WNY Automation Portal',
    workspaceLabel: 'Workspace',
    defaultRoute: '/app',
  });

  const selectedPreset = useMemo(
    () => INDUSTRY_PRESETS.find((p) => p.key === branding.industry) ?? INDUSTRY_PRESETS[0],
    [branding.industry],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantRes, usersRes, modulesRes, crmRes, auditRes] = await Promise.all([
        fetch(`/api/admin/tenants/${id}`, { cache: 'no-store' }),
        fetch(`/api/admin/tenants/${id}/users`, { cache: 'no-store' }),
        fetch(`/api/admin/tenants/${id}/modules`, { cache: 'no-store' }),
        fetch(`/api/admin/tenants/${id}/crm-config`, { cache: 'no-store' }),
        fetch(`/api/audit-log?companyId=${id}&limit=50`, { cache: 'no-store' }),
      ]);
      const tenantJson = await tenantRes.json();
      const nextTenant = tenantJson.tenant as Tenant;
      const usersJson = await usersRes.json();
      const modulesJson = await modulesRes.json();
      const crmJson = await crmRes.json();
      const auditJson = await auditRes.json();
      setTenant(nextTenant);
      setUsers(usersJson.users || []);
      setEnabledModules(modulesJson.enabledModules || []);
      setFields((crmJson.fields || []).map(normalizeField));
      setStages((crmJson.stages || []).map(normalizeStage));
      setAudit(auditJson.events || []);
      if (nextTenant) {
        setBranding({
          displayName: nextTenant.display_name || nextTenant.name || '',
          legalName: nextTenant.legal_name || nextTenant.name || '',
          industry: nextTenant.industry || 'generic',
          timezone: nextTenant.timezone || 'America/New_York',
          logoUrl: nextTenant.logo_url || '',
          primaryColor: nextTenant.primary_color || '#ea580c',
          accentColor: nextTenant.accent_color || '#2563eb',
          portalTitle: nextTenant.portal_title || 'WNY Automation Portal',
          workspaceLabel: nextTenant.workspace_label || 'Workspace',
          defaultRoute: nextTenant.default_route || '/app',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTenant() {
    setSaving(true);
    try {
      await fetch(`/api/admin/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tenant?.name,
          email: tenant?.email,
          phone: tenant?.phone,
          settings: branding,
        }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function addUser() {
    if (!userForm.email) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/tenants/${id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      setUserForm({ email: '', name: '', role: 'staff' });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(userId: string, patch: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch(`/api/admin/tenants/${id}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveModules() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tenants/${id}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledModules }),
      });
      const json = await res.json();
      setEnabledModules(json.enabledModules || enabledModules);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveCrmConfig(preset?: string) {
    setSaving(true);
    try {
      await fetch(`/api/admin/tenants/${id}/crm-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset, fields, stages }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  function toggleModule(key: ModuleKey) {
    setEnabledModules((mods) => (mods.includes(key) ? mods.filter((m) => m !== key) : [...mods, key]));
  }

  if (loading && !tenant) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tenant...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      <header className="mb-6">
        <Link href="/super-admin" className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Back to tenants
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">{branding.displayName || tenant?.name || 'Tenant'}</h1>
            <p className="text-sm text-slate-600">{tenant?.email} - {selectedPreset.label}</p>
          </div>
          <button
            onClick={saveTenant}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save tenant
          </button>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              tab === key ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Tenant profile">
            <Field label="Company name" value={tenant?.name || ''} onChange={(v) => setTenant((t) => t ? { ...t, name: v } : t)} />
            <Field label="Contact email" value={tenant?.email || ''} onChange={(v) => setTenant((t) => t ? { ...t, email: v } : t)} />
            <Field label="Phone" value={tenant?.phone || ''} onChange={(v) => setTenant((t) => t ? { ...t, phone: v } : t)} />
          </Panel>
          <Panel title="Workspace">
            <Metric label="Enabled modules" value={enabledModules.length} />
            <Metric label="Assigned users" value={users.length} />
            <Metric label="Custom fields" value={fields.filter((f) => f.isActive !== false).length} />
          </Panel>
          <Panel title="Preview">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold text-white" style={{ background: branding.primaryColor }}>
                  {(branding.displayName || 'WNY').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-slate-950">{branding.portalTitle}</div>
                  <div className="text-xs text-slate-500">{branding.workspaceLabel}</div>
                </div>
              </div>
              <div className="h-2 rounded-full" style={{ background: branding.accentColor }} />
            </div>
          </Panel>
        </section>
      ) : null}

      {tab === 'users' ? (
        <section className="space-y-4">
          <Panel title="Assign user">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Email" value={userForm.email} onChange={(v) => setUserForm((f) => ({ ...f, email: v }))} />
              <Field label="Name" value={userForm.name} onChange={(v) => setUserForm((f) => ({ ...f, name: v }))} />
              <Select label="Role" value={userForm.role} options={roles} onChange={(v) => setUserForm((f) => ({ ...f, role: v }))} />
              <button onClick={addUser} disabled={saving || !userForm.email} className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">
                <Plus className="h-4 w-4" /> Assign
              </button>
            </div>
          </Panel>
          <Panel title="Tenant users">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="py-3">
                        <div className="font-medium text-slate-950">{user.name || user.email}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </td>
                      <td className="py-3">
                        <select value={user.role} onChange={(e) => updateUser(user.id, { role: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                          {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => updateUser(user.id, { isActive: !active(user.is_active) })} className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                          {active(user.is_active) ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      ) : null}

      {tab === 'modules' ? (
        <Panel title="Enabled modules">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MODULE_CATALOG.map((mod) => {
              const enabled = enabledModules.includes(mod.key);
              return (
                <button key={mod.key} onClick={() => toggleModule(mod.key)} className={`rounded-lg border p-4 text-left ${enabled ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-950">{mod.label}</div>
                    {enabled ? <Check className="h-4 w-4 text-orange-600" /> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{mod.description}</div>
                  {mod.dependencies?.length ? <div className="mt-2 text-xs text-slate-400">Requires {mod.dependencies.join(', ')}</div> : null}
                </button>
              );
            })}
          </div>
          <button onClick={saveModules} disabled={saving} className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
            Save modules
          </button>
        </Panel>
      ) : null}

      {tab === 'branding' ? (
        <Panel title="Branding">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Display name" value={branding.displayName} onChange={(v) => setBranding((b) => ({ ...b, displayName: v }))} />
            <Field label="Legal name" value={branding.legalName} onChange={(v) => setBranding((b) => ({ ...b, legalName: v }))} />
            <Select label="Industry preset" value={branding.industry} options={INDUSTRY_PRESETS.map((p) => p.key)} onChange={(v) => setBranding((b) => ({ ...b, industry: v }))} />
            <Field label="Timezone" value={branding.timezone} onChange={(v) => setBranding((b) => ({ ...b, timezone: v }))} />
            <Field label="Logo URL" value={branding.logoUrl} onChange={(v) => setBranding((b) => ({ ...b, logoUrl: v }))} />
            <Field label="Portal title" value={branding.portalTitle} onChange={(v) => setBranding((b) => ({ ...b, portalTitle: v }))} />
            <Field label="Workspace label" value={branding.workspaceLabel} onChange={(v) => setBranding((b) => ({ ...b, workspaceLabel: v }))} />
            <Field label="Default route" value={branding.defaultRoute} onChange={(v) => setBranding((b) => ({ ...b, defaultRoute: v }))} />
            <Color label="Primary color" value={branding.primaryColor} onChange={(v) => setBranding((b) => ({ ...b, primaryColor: v }))} />
            <Color label="Accent color" value={branding.accentColor} onChange={(v) => setBranding((b) => ({ ...b, accentColor: v }))} />
          </div>
        </Panel>
      ) : null}

      {tab === 'crm' ? (
        <section className="space-y-4">
          <Panel title="Industry preset">
            <div className="flex flex-wrap items-center gap-3">
              <select value={branding.industry} onChange={(e) => setBranding((b) => ({ ...b, industry: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {INDUSTRY_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <button onClick={() => saveCrmConfig(branding.industry)} disabled={saving} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Apply preset without deleting existing config
              </button>
            </div>
          </Panel>
          <Panel title="Custom fields">
            <button onClick={() => setFields((f) => [...f, { entityType: 'lead', fieldKey: '', label: '', fieldType: 'text', required: false, isActive: true }])} className="mb-3 rounded-md border border-slate-200 px-3 py-1 text-sm">Add field</button>
            <EditableFields fields={fields} setFields={setFields} />
          </Panel>
          <Panel title="Pipeline stages">
            <button onClick={() => setStages((s) => [...s, { entityType: 'lead', stageKey: '', label: '', color: '#2563eb', isActive: true }])} className="mb-3 rounded-md border border-slate-200 px-3 py-1 text-sm">Add stage</button>
            <EditableStages stages={stages} setStages={setStages} />
            <button onClick={() => saveCrmConfig()} disabled={saving} className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save CRM setup</button>
          </Panel>
        </section>
      ) : null}

      {tab === 'integrations' ? (
        <Panel title="Integrations">
          <div className="grid gap-3 md:grid-cols-2">
            {['Clerk auth', 'Stripe payments', 'Twilio SMS', 'Retell receptionist', 'R2 uploads', 'n8n lead webhook'].map((name) => (
              <div key={name} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="font-medium text-slate-950">{name}</div>
                <div className="mt-1 text-xs text-slate-500">Configured through environment variables and provider dashboards.</div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {tab === 'audit' ? (
        <Panel title="Recent audit log">
          <div className="divide-y divide-slate-100">
            {audit.map((event) => (
              <div key={event.id} className="py-3 text-sm">
                <div className="font-medium text-slate-950">{event.summary || event.action}</div>
                <div className="text-xs text-slate-500">{event.actor_email || 'system'} - {event.action} - {new Date(event.created_at).toLocaleString()}</div>
              </div>
            ))}
            {!audit.length ? <div className="py-4 text-sm text-slate-500">No audit events yet.</div> : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 rounded border border-slate-300 bg-white p-1" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400" />
      </div>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function EditableFields({ fields, setFields }: { fields: CustomField[]; setFields: Dispatch<SetStateAction<CustomField[]>> }) {
  return (
    <div className="space-y-2">
      {fields.map((field, idx) => (
        <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-5">
          <input value={String(field.entityType || '')} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, entityType: e.target.value } : r))} className="rounded border px-2 py-1 text-sm" placeholder="entity" />
          <input value={String(field.fieldKey || '')} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, fieldKey: e.target.value } : r))} className="rounded border px-2 py-1 text-sm" placeholder="key" />
          <input value={field.label || ''} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, label: e.target.value } : r))} className="rounded border px-2 py-1 text-sm" placeholder="Label" />
          <input value={String(field.fieldType || 'text')} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, fieldType: e.target.value } : r))} className="rounded border px-2 py-1 text-sm" placeholder="type" />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, required: e.target.checked } : r))} />
            Required
          </label>
        </div>
      ))}
    </div>
  );
}

function EditableStages({ stages, setStages }: { stages: PipelineStage[]; setStages: Dispatch<SetStateAction<PipelineStage[]>> }) {
  return (
    <div className="space-y-2">
      {stages.map((stage, idx) => (
        <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-5">
          <input value={String(stage.entityType || '')} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, entityType: e.target.value } : r))} className="rounded border px-2 py-1 text-sm" placeholder="entity" />
          <input value={String(stage.stageKey || '')} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, stageKey: e.target.value } : r))} className="rounded border px-2 py-1 text-sm" placeholder="key" />
          <input value={stage.label || ''} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, label: e.target.value } : r))} className="rounded border px-2 py-1 text-sm" placeholder="Label" />
          <input type="color" value={stage.color || '#2563eb'} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, color: e.target.value } : r))} className="h-9 rounded border bg-white p-1" />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={active(stage.isActive)} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, isActive: e.target.checked } : r))} />
            Active
          </label>
        </div>
      ))}
    </div>
  );
}
