'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppPageHeader,
  ConsolePanel,
  DataTable,
  DetailDrawer,
  EmptyState,
  KpiStrip,
  OpsButton,
  OpsInput,
  OpsSelect,
  OpsTextarea,
  SearchField,
  StatCard,
  StatusBadge,
} from '@/components/ops/ui';
import type { GrowthFieldConfig, GrowthModuleConfig } from '@/lib/awp/config';
import { ClipboardList, FileText, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';

type GrowthRecord = {
  id: string;
  record_type: string;
  title: string;
  status: string;
  owner?: string | null;
  payload?: Record<string, unknown>;
  is_demo?: boolean;
  updated_at?: string;
};

type DraftRecord = {
  id?: string;
  title: string;
  status: string;
  owner: string;
  payload: Record<string, unknown>;
};

function fieldValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (value == null) return '';
  return String(value);
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusTone(status: string): 'brand' | 'success' | 'warning' | 'neutral' | 'danger' {
  const normalized = status.toLowerCase();
  if (['active', 'published', 'approved', 'complete', 'completed', 'ready for review'].includes(normalized)) {
    return 'success';
  }
  if (['drafting', 'in progress', 'needs review', 'needs photos', 'planned'].includes(normalized)) {
    return 'warning';
  }
  if (['paused', 'archived'].includes(normalized)) return 'neutral';
  if (['high'].includes(normalized)) return 'danger';
  return 'brand';
}

function createEmptyDraft(config: GrowthModuleConfig): DraftRecord {
  return {
    title: '',
    status: config.statusOptions[0] || 'Idea',
    owner: '',
    payload: Object.fromEntries(config.fields.map((field) => [field.key, field.type === 'number' ? 0 : ''])),
  };
}

function renderField(
  field: GrowthFieldConfig,
  value: string,
  onChange: (value: string | number) => void,
) {
  if (field.type === 'textarea') {
    return (
      <OpsTextarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        rows={4}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <OpsSelect value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select...</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </OpsSelect>
    );
  }

  return (
    <OpsInput
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
      value={value}
      onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value || 0) : event.target.value)}
      placeholder={field.placeholder}
    />
  );
}

export function GrowthModulePage({ config, embedded = false }: { config: GrowthModuleConfig; embedded?: boolean }) {
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [draft, setDraft] = useState<DraftRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/growth-records?type=${config.type}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to load records');
      setRecords(json.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [config.type]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRecords = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return records.filter((record) => {
      const payload = record.payload || {};
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesSearch =
        !needle ||
        [record.title, record.status, record.owner, ...Object.values(payload)]
          .filter((value) => typeof value === 'string' || typeof value === 'number')
          .some((value) => String(value).toLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [records, search, statusFilter]);

  const stats = useMemo(() => {
    const active = records.filter((record) =>
      ['Active', 'Ready', 'Approved', 'Published', 'In Progress', 'Planned'].includes(record.status),
    ).length;
    const demo = records.filter((record) => record.is_demo).length;
    const needsReview = records.filter((record) =>
      ['Needs Review', 'Needs Info', 'Needs Photos', 'Drafting Case Study'].includes(record.status),
    ).length;

    return { total: records.length, active, needsReview, demo };
  }, [records]);

  function openNew() {
    setDraft(createEmptyDraft(config));
  }

  function openEdit(record: GrowthRecord) {
    setDraft({
      id: record.id,
      title: record.title,
      status: record.status,
      owner: record.owner || '',
      payload: { ...(record.payload || {}) },
    });
  }

  async function saveDraft() {
    if (!draft?.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/growth-records', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          record_type: config.type,
          title: draft.title,
          status: draft.status,
          owner: draft.owner,
          payload: draft.payload,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to save record');
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save record');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!draft?.id || !confirm(`Delete ${draft.title}?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/growth-records?id=${encodeURIComponent(draft.id)}`, {
        method: 'DELETE',
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to delete record');
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record');
    } finally {
      setSaving(false);
    }
  }

  const selectedRecord = draft?.id ? records.find((record) => record.id === draft.id) : null;
  const contacts = Array.isArray(selectedRecord?.payload?.contacts) ? selectedRecord.payload.contacts : [];

  const actions = (
    <>
      <SearchField
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={`Search ${config.navLabel.toLowerCase()}...`}
        className="min-w-[min(360px,100%)]"
      />
      <OpsButton type="button" variant="secondary" onClick={load}>
        <RefreshCw className="h-4 w-4" />
        Refresh
      </OpsButton>
      <OpsButton type="button" variant="primary" onClick={openNew}>
        <Plus className="h-4 w-4" />
        {config.addLabel}
      </OpsButton>
    </>
  );

  const content = (
    <>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-4 shadow-[var(--ops-shadow-soft)]">
          <div>
            <p className="text-sm font-semibold text-[var(--ops-text)]">{config.title}</p>
            <p className="mt-1 max-w-3xl text-sm text-[var(--ops-muted)]">{config.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        </div>
      ) : (
        <AppPageHeader
          icon={ClipboardList}
          eyebrow={config.eyebrow}
          title={config.title}
          description={config.description}
          actions={actions}
        />
      )}

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <KpiStrip>
            <StatCard label="Total" value={loading ? '...' : stats.total} meta={config.navLabel} tone="brand" icon={FileText} />
            <StatCard label="Active / Ready" value={loading ? '...' : stats.active} meta="Current growth work" tone="success" icon={Sparkles} />
            <StatCard label="Needs attention" value={loading ? '...' : stats.needsReview} meta="Review, info, or photos needed" tone="warning" icon={ClipboardList} />
            <StatCard label="Demo records" value={loading ? '...' : stats.demo} meta="Replace with verified client data" tone="neutral" icon={FileText} />
          </KpiStrip>

          <ConsolePanel
            title={config.navLabel}
            description="Use the status filter to keep the owner view focused during weekly growth reviews."
            action={
              <OpsSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-48">
                <option value="all">All statuses</option>
                {config.statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </OpsSelect>
            }
          >
            {loading ? (
              <EmptyState title="Loading" description="Fetching the latest AWP growth records." />
            ) : filteredRecords.length === 0 ? (
              <EmptyState
                title="No records found"
                description="Create a new record or adjust the current filters."
                action={
                  <OpsButton type="button" variant="primary" onClick={openNew}>
                    <Plus className="h-4 w-4" />
                    {config.addLabel}
                  </OpsButton>
                }
              />
            ) : (
              <DataTable
                columns={[
                  { key: 'title', label: 'Title' },
                  { key: 'status', label: 'Status' },
                  { key: 'summary', label: 'Summary' },
                  { key: 'owner', label: 'Owner' },
                  { key: 'updated', label: 'Updated' },
                ]}
                footer={`Showing ${filteredRecords.length} of ${records.length} records`}
                minWidthClassName="min-w-[980px]"
                className="border-0 shadow-none"
              >
                {filteredRecords.map((record) => {
                  const payload = record.payload || {};
                  return (
                    <tr
                      key={record.id}
                      className="cursor-pointer transition-colors hover:bg-[var(--ops-surface-subtle)]"
                      onClick={() => openEdit(record)}
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-[var(--ops-text)]">{record.title}</p>
                        {record.is_demo ? <p className="mt-1 text-xs text-[var(--ops-muted)]">Demo data</p> : null}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={statusTone(record.status)}>{record.status}</StatusBadge>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">
                        <div className="flex max-w-2xl flex-wrap gap-2">
                          {config.summaryFields.map((key) => (
                            <span key={key} className="rounded-full bg-[var(--ops-surface-subtle)] px-2.5 py-1 text-xs">
                              {fieldValue(payload, key) || '-'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{record.owner || '-'}</td>
                      <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{formatDate(record.updated_at)}</td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </ConsolePanel>
    </>
  );

  const drawer = (
    <DetailDrawer
      open={Boolean(draft)}
      onClose={() => setDraft(null)}
      title={draft?.id ? 'Edit record' : config.addLabel}
      description={draft?.id ? 'Update this growth record.' : `Create a new ${config.navLabel.toLowerCase()} record.`}
      footer={
        <div className="flex items-center justify-between gap-3">
          {draft?.id ? (
            <OpsButton type="button" variant="danger" onClick={deleteRecord} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Delete
            </OpsButton>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <OpsButton type="button" variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </OpsButton>
            <OpsButton type="button" variant="primary" onClick={saveDraft} disabled={saving || !draft?.title.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </OpsButton>
          </div>
        </div>
      }
    >
      {draft ? (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Title</label>
            <OpsInput
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Record title"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Status</label>
              <OpsSelect value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                {config.statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </OpsSelect>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Owner</label>
              <OpsInput
                value={draft.owner}
                onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
                placeholder="Owner"
              />
            </div>
          </div>
          {config.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">{field.label}</label>
              {renderField(field, fieldValue(draft.payload, field.key), (value) =>
                setDraft({
                  ...draft,
                  payload: { ...draft.payload, [field.key]: value },
                }),
              )}
            </div>
          ))}

          {contacts.length > 0 ? (
            <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] p-4">
              <h3 className="text-sm font-semibold text-[var(--ops-text)]">List contacts</h3>
              <div className="mt-3 space-y-2">
                {contacts.map((contact, index) => {
                  const row = contact as Record<string, unknown>;
                  return (
                    <div key={index} className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm">
                      <p className="font-semibold text-[var(--ops-text)]">{String(row.name || row.businessName || 'Contact')}</p>
                      <p className="mt-1 text-[var(--ops-muted)]">
                        {[row.businessName, row.email, row.location, row.outreachStatus].filter(Boolean).join(' / ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </DetailDrawer>
  );

  if (embedded) {
    return (
      <div className="flex flex-col gap-6">
        {content}
        {drawer}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">{content}</div>
      </main>
      {drawer}
    </div>
  );
}
