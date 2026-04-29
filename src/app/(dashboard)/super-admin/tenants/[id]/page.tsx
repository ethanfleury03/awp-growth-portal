'use client';

import Link from 'next/link';
import type { ComponentType, Dispatch, ReactNode, SetStateAction } from 'react';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ClipboardList,
  ExternalLink,
  Loader2,
  Palette,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
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
  stripe_connect_status?: string | null;
  subscription_status?: string | null;
  metrics?: {
    user_count?: number;
    enabled_module_count?: number;
    audit_event_count?: number;
    last_activity_at?: string | null;
    last_lead_at?: string | null;
    last_user_activity_at?: string | null;
  };
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

type Integration = {
  key: string;
  label: string;
  configured: boolean;
};

type DeletedRow = {
  entityType: string;
  fieldKey?: string;
  stageKey?: string;
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
const entityTypes = ['lead', 'customer', 'job', 'estimate'];
const fieldTypes = ['text', 'textarea', 'number', 'date', 'select', 'boolean', 'email', 'phone', 'url'];
const moduleGroups = [
  { label: 'Core CRM', keys: ['dashboard', 'leads', 'crm', 'customers', 'jobs', 'estimates', 'invoices'] },
  { label: 'Operations', keys: ['dispatch', 'calendar', 'assets'] },
  { label: 'Growth and AI', keys: ['receptionist', 'marketing', 'outreach', 'ai-assistant'] },
  { label: 'Reporting and Settings', keys: ['reports', 'settings'] },
] satisfies { label: string; keys: ModuleKey[] }[];

function active(value: boolean | number | undefined) {
  return value === true || value === 1 || value === undefined;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
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
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [enabledModules, setEnabledModules] = useState<ModuleKey[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deletedFields, setDeletedFields] = useState<DeletedRow[]>([]);
  const [deletedStages, setDeletedStages] = useState<DeletedRow[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
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

  const activeFields = fields.filter((f) => active(f.isActive));
  const activeStages = stages.filter((s) => active(s.isActive));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantRes, usersRes, modulesRes, crmRes, auditRes, integrationsRes] = await Promise.all([
        fetch(`/api/admin/tenants/${id}`, { cache: 'no-store' }),
        fetch(`/api/admin/tenants/${id}/users`, { cache: 'no-store' }),
        fetch(`/api/admin/tenants/${id}/modules`, { cache: 'no-store' }),
        fetch(`/api/admin/tenants/${id}/crm-config`, { cache: 'no-store' }),
        fetch(`/api/audit-log?companyId=${id}&limit=50`, { cache: 'no-store' }),
        fetch(`/api/admin/tenants/${id}/integrations`, { cache: 'no-store' }),
      ]);
      const tenantJson = await tenantRes.json();
      const usersJson = await usersRes.json();
      const modulesJson = await modulesRes.json();
      const crmJson = await crmRes.json();
      const auditJson = await auditRes.json();
      const integrationsJson = await integrationsRes.json();
      if (!tenantRes.ok) throw new Error(tenantJson.error || 'Could not load tenant.');
      const nextTenant = tenantJson.tenant as Tenant;
      setTenant(nextTenant);
      setUsers(usersJson.users || []);
      setEnabledModules(modulesJson.enabledModules || []);
      setFields((crmJson.fields || []).map(normalizeField));
      setStages((crmJson.stages || []).map(normalizeStage));
      setDeletedFields([]);
      setDeletedStages([]);
      setAudit(auditJson.events || []);
      setIntegrations(integrationsJson.integrations || []);
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
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not load tenant.' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function withSave(label: string, fn: () => Promise<void>, success: string) {
    setSaving(label);
    setNotice(null);
    try {
      await fn();
      setNotice({ type: 'success', text: success });
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not save changes.' });
    } finally {
      setSaving(null);
    }
  }

  async function saveTenant() {
    if (!tenant?.name || !tenant.email) {
      setNotice({ type: 'error', text: 'Company name and contact email are required.' });
      return;
    }
    await withSave('tenant', async () => {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tenant.name,
          email: tenant.email,
          phone: tenant.phone,
          settings: branding,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save tenant.');
      await load();
    }, 'Tenant saved.');
  }

  async function addUser() {
    if (!userForm.email.trim()) {
      setNotice({ type: 'error', text: 'Email is required.' });
      return;
    }
    await withSave('user', async () => {
      const res = await fetch(`/api/admin/tenants/${id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not assign user.');
      setUserForm({ email: '', name: '', role: 'staff' });
      await load();
    }, 'User assigned.');
  }

  async function updateUser(userId: string, patch: Record<string, unknown>) {
    await withSave(`user-${userId}`, async () => {
      const res = await fetch(`/api/admin/tenants/${id}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not update user.');
      await load();
    }, 'User updated.');
  }

  async function saveModules() {
    await withSave('modules', async () => {
      const res = await fetch(`/api/admin/tenants/${id}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledModules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save modules.');
      setEnabledModules(json.enabledModules || enabledModules);
      await load();
    }, 'Modules saved. Dependencies were applied automatically.');
  }

  async function saveCrmConfig(preset?: string) {
    await withSave('crm', async () => {
      const res = await fetch(`/api/admin/tenants/${id}/crm-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset,
          fields: activeFields,
          stages: activeStages,
          deleteFields: deletedFields,
          deleteStages: deletedStages,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save CRM setup.');
      await load();
    }, preset ? 'Preset applied without deleting existing config.' : 'CRM setup saved.');
  }

  function toggleModule(key: ModuleKey) {
    setEnabledModules((mods) => (mods.includes(key) ? mods.filter((m) => m !== key) : [...mods, key]));
  }

  function removeField(index: number) {
    const field = fields[index];
    if (field?.entityType && field?.fieldKey) {
      setDeletedFields((rows) => [...rows, { entityType: String(field.entityType), fieldKey: String(field.fieldKey) }]);
    }
    setFields((rows) => rows.filter((_, i) => i !== index));
  }

  function removeStage(index: number) {
    const stage = stages[index];
    if (stage?.entityType && stage?.stageKey) {
      setDeletedStages((rows) => [...rows, { entityType: String(stage.entityType), stageKey: String(stage.stageKey) }]);
    }
    setStages((rows) => rows.filter((_, i) => i !== index));
  }

  if (loading && !tenant) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tenant...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6">
      <header className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur lg:-mx-6 lg:-mt-6 lg:px-6">
        <Link href="/super-admin" className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Back to tenants
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{branding.displayName || tenant?.name || 'Tenant'}</h1>
            <p className="text-sm text-slate-600">{tenant?.email} - {selectedPreset.label}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/super-admin/tenants/${id}/preview`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              <ExternalLink className="h-4 w-4" /> Preview workspace
            </Link>
            <button
              onClick={saveTenant}
              disabled={Boolean(saving)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {saving === 'tenant' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save tenant
            </button>
          </div>
        </div>
      </header>

      {notice ? (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
          notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {notice.text}
        </div>
      ) : null}

      <nav className="mt-5 flex flex-wrap gap-2">
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

      <main className="mt-5">
        {tab === 'overview' ? (
          <section className="grid gap-4 xl:grid-cols-3">
            <Panel title="Tenant profile">
              <div className="grid gap-3">
                <Field label="Company name" value={tenant?.name || ''} onChange={(v) => setTenant((t) => t ? { ...t, name: v } : t)} />
                <Field label="Contact email" value={tenant?.email || ''} onChange={(v) => setTenant((t) => t ? { ...t, email: v } : t)} />
                <Field label="Phone" value={tenant?.phone || ''} onChange={(v) => setTenant((t) => t ? { ...t, phone: v } : t)} />
              </div>
            </Panel>
            <Panel title="Workspace stats">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Enabled modules" value={enabledModules.length} />
                <Metric label="Assigned users" value={users.length} />
                <Metric label="Custom fields" value={activeFields.length} />
                <Metric label="Pipeline stages" value={activeStages.length} />
                <Metric label="Audit events" value={Number(tenant?.metrics?.audit_event_count || audit.length)} />
                <Metric label="Configured integrations" value={integrations.filter((item) => item.configured).length} />
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                Last lead: {tenant?.metrics?.last_lead_at ? new Date(tenant.metrics.last_lead_at).toLocaleString() : 'none yet'}
                <br />
                Last user update: {tenant?.metrics?.last_user_activity_at ? new Date(tenant.metrics.last_user_activity_at).toLocaleString() : 'none yet'}
              </div>
            </Panel>
            <Panel title="Live preview">
              <BrandPreview branding={branding} />
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
                <button onClick={addUser} disabled={Boolean(saving) || !userForm.email} className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">
                  {saving === 'user' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Assign
                </button>
              </div>
            </Panel>
            <Panel title="Tenant users">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2">User</th>
                      <th className="py-2">Role</th>
                      <th className="py-2">Clerk</th>
                      <th className="py-2 text-right">Status</th>
                    </tr>
                  </thead>
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
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.clerk_user_id ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {user.clerk_user_id ? 'Linked' : 'Email only'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button onClick={() => updateUser(user.id, { isActive: !active(user.is_active) })} className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                            {active(user.is_active) ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!users.length ? (
                      <tr><td colSpan={4} className="py-8 text-center text-slate-500">No users assigned yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        ) : null}

        {tab === 'modules' ? (
          <Panel title="Enabled modules">
            <p className="mb-4 text-sm text-slate-500">Dependencies are applied automatically when you save.</p>
            <div className="space-y-5">
              {moduleGroups.map((group) => (
                <section key={group.label}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h3>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.keys.map((key) => {
                      const mod = MODULE_CATALOG.find((m) => m.key === key);
                      if (!mod) return null;
                      const enabled = enabledModules.includes(mod.key);
                      return (
                        <button key={mod.key} onClick={() => toggleModule(mod.key)} className={`rounded-lg border p-4 text-left ${enabled ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-slate-950">{mod.label}</div>
                            {enabled ? <Check className="h-4 w-4 text-orange-600" /> : null}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{mod.description}</div>
                          {mod.dependencies?.length ? <div className="mt-2 text-xs text-slate-400">Requires {mod.dependencies.join(', ')}</div> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <button onClick={saveModules} disabled={Boolean(saving)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
              {saving === 'modules' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save modules
            </button>
          </Panel>
        ) : null}

        {tab === 'branding' ? (
          <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
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
              <button onClick={saveTenant} disabled={Boolean(saving)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                {saving === 'tenant' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save branding
              </button>
            </Panel>
            <Panel title="Preview">
              <BrandPreview branding={branding} />
            </Panel>
          </section>
        ) : null}

        {tab === 'crm' ? (
          <section className="space-y-4">
            <Panel title="Industry preset">
              <div className="flex flex-wrap items-center gap-3">
                <select value={branding.industry} onChange={(e) => setBranding((b) => ({ ...b, industry: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {INDUSTRY_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <button onClick={() => saveCrmConfig(branding.industry)} disabled={Boolean(saving)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Apply preset without deleting existing config
                </button>
              </div>
            </Panel>
            <Panel title="Custom fields">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-500">Client-specific fields for leads, customers, jobs, and estimates.</p>
                <button onClick={() => setFields((f) => [...f, { entityType: 'lead', fieldKey: '', label: '', fieldType: 'text', required: false, isActive: true }])} className="rounded-md border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50">Add field</button>
              </div>
              <EditableFields fields={fields} setFields={setFields} onRemove={removeField} />
            </Panel>
            <Panel title="Pipeline stages">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-500">Tenant-specific board stages for pipelines.</p>
                <button onClick={() => setStages((s) => [...s, { entityType: 'lead', stageKey: '', label: '', color: '#2563eb', isActive: true }])} className="rounded-md border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50">Add stage</button>
              </div>
              <EditableStages stages={stages} setStages={setStages} onRemove={removeStage} />
              <button onClick={() => saveCrmConfig()} disabled={Boolean(saving)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving === 'crm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save CRM setup
              </button>
            </Panel>
          </section>
        ) : null}

        {tab === 'integrations' ? (
          <Panel title="Integrations">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {integrations.map((item) => (
                <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-950">{item.label}</div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.configured ? 'Configured' : 'Not configured'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">Managed through environment variables and provider dashboards for v1.</div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {tab === 'audit' ? (
          <Panel title="Recent audit log">
            <div className="divide-y divide-slate-100">
              {audit.map((event) => (
                <div key={event.id} className="grid gap-1 py-3 text-sm md:grid-cols-[1fr_12rem_12rem] md:items-center">
                  <div>
                    <div className="font-medium text-slate-950">{event.summary || event.action}</div>
                    <div className="text-xs text-slate-500">{event.entity_type || 'tenant'} - {event.action}</div>
                  </div>
                  <div className="text-xs text-slate-500">{event.actor_email || 'system'}</div>
                  <div className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</div>
                </div>
              ))}
              {!audit.length ? <div className="py-8 text-center text-sm text-slate-500">No audit events yet.</div> : null}
            </div>
          </Panel>
        ) : null}
      </main>
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

function BrandPreview({ branding }: { branding: { displayName: string; portalTitle: string; workspaceLabel: string; primaryColor: string; accentColor: string; logoUrl: string } }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: branding.primaryColor }}>
            {branding.logoUrl ? 'Logo' : (branding.displayName || 'WNY').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-white">{branding.portalTitle}</div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{branding.displayName || 'Client Portal'}</div>
          </div>
        </div>
      </div>
      <div className="space-y-2 p-4">
        {['Dashboard', branding.workspaceLabel || 'Workspace', 'Reports'].map((item, idx) => (
          <div key={item} className={`rounded-lg px-3 py-2 text-sm ${idx === 0 ? 'text-white' : 'text-slate-300'}`} style={idx === 0 ? { background: branding.accentColor } : undefined}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditableFields({
  fields,
  setFields,
  onRemove,
}: {
  fields: CustomField[];
  setFields: Dispatch<SetStateAction<CustomField[]>>;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {fields.map((field, idx) => (
        <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[8rem_1fr_1fr_8rem_7rem_2rem]">
          <select value={String(field.entityType || 'lead')} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, entityType: e.target.value } : r))} className="rounded border px-2 py-1 text-sm">
            {entityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input value={field.label || ''} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, label: e.target.value, fieldKey: r.fieldKey || slugify(e.target.value) } : r))} className="rounded border px-2 py-1 text-sm" placeholder="Label" />
          <input value={String(field.fieldKey || '')} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, fieldKey: slugify(e.target.value) } : r))} className="rounded border px-2 py-1 text-sm" placeholder="field_key" />
          <select value={String(field.fieldType || 'text')} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, fieldType: e.target.value } : r))} className="rounded border px-2 py-1 text-sm">
            {fieldTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => setFields((rows) => rows.map((r, i) => i === idx ? { ...r, required: e.target.checked } : r))} />
            Required
          </label>
          <button onClick={() => onRemove(idx)} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove field">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {!fields.length ? <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">No custom fields yet.</div> : null}
    </div>
  );
}

function EditableStages({
  stages,
  setStages,
  onRemove,
}: {
  stages: PipelineStage[];
  setStages: Dispatch<SetStateAction<PipelineStage[]>>;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {stages.map((stage, idx) => (
        <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[8rem_1fr_1fr_5rem_7rem_2rem]">
          <select value={String(stage.entityType || 'lead')} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, entityType: e.target.value } : r))} className="rounded border px-2 py-1 text-sm">
            {entityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input value={stage.label || ''} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, label: e.target.value, stageKey: r.stageKey || slugify(e.target.value) } : r))} className="rounded border px-2 py-1 text-sm" placeholder="Label" />
          <input value={String(stage.stageKey || '')} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, stageKey: slugify(e.target.value) } : r))} className="rounded border px-2 py-1 text-sm" placeholder="stage_key" />
          <input type="color" value={stage.color || '#2563eb'} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, color: e.target.value } : r))} className="h-9 rounded border bg-white p-1" />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={active(stage.isActive)} onChange={(e) => setStages((rows) => rows.map((r, i) => i === idx ? { ...r, isActive: e.target.checked } : r))} />
            Active
          </label>
          <button onClick={() => onRemove(idx)} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove stage">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {!stages.length ? <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">No pipeline stages yet.</div> : null}
    </div>
  );
}
