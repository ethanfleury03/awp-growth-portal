'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ConsolePanel,
  DataTable,
  DetailDrawer,
  EmptyState,
  OpsButton,
  OpsInput,
  OpsSelect,
  OpsTextarea,
  SearchField,
  StatusBadge,
} from '@/components/ops/ui';
import { Database, FileUp, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

type KnowledgeItem = {
  id: string;
  title: string;
  item_type: string;
  status: string;
  body?: string | null;
  url?: string | null;
  tags?: string[];
  is_pinned?: boolean;
  updated_at?: string;
};

type Attachment = {
  id: string;
  file_name?: string;
  mime_type?: string;
  publicUrl?: string | null;
};

type Draft = {
  id?: string;
  title: string;
  itemType: string;
  status: string;
  body: string;
  url: string;
  tags: string;
  isPinned: boolean;
};

const KB_TYPES = [
  'Company Facts',
  'Services',
  'Sales Rules',
  'FAQs',
  'Website Notes',
  'Marketing Voice',
  'Images/Files',
  'Do Not Say',
  'Pricing/Warranty Guardrails',
  'Other',
];

function emptyDraft(): Draft {
  return {
    title: '',
    itemType: 'Company Facts',
    status: 'Active',
    body: '',
    url: '',
    tags: '',
    isPinned: false,
  };
}

function draftFromItem(item: KnowledgeItem): Draft {
  return {
    id: item.id,
    title: item.title,
    itemType: item.item_type || 'Other',
    status: item.status || 'Active',
    body: item.body || '',
    url: item.url || '',
    tags: (item.tags || []).join(', '),
    isPinned: Boolean(item.is_pinned),
  };
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function KnowledgeBasePanel() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const response = await fetch(`/api/knowledge?${params.toString()}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to load knowledge base');
      setItems(json.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  const loadAttachments = useCallback(async (id: string) => {
    const response = await fetch(`/api/attachments?entityType=knowledge_item&entityId=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const json = await response.json();
    setAttachments(response.ok ? json.attachments || [] : []);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => load(), 150);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (draft?.id) {
      loadAttachments(draft.id);
    } else {
      setAttachments([]);
    }
  }, [draft?.id, loadAttachments]);

  const stats = useMemo(
    () => ({
      total: items.length,
      pinned: items.filter((item) => item.is_pinned).length,
      guardrails: items.filter((item) => ['Do Not Say', 'Pricing/Warranty Guardrails'].includes(item.item_type)).length,
    }),
    [items],
  );

  async function saveDraft() {
    if (!draft?.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(draft.id ? `/api/knowledge/${draft.id}` : '/api/knowledge', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to save knowledge item');
      setDraft(draft.id ? draft : draftFromItem(json.item));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save knowledge item');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!draft?.id || !confirm(`Delete ${draft.title}?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/knowledge/${draft.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to delete knowledge item');
      }
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete knowledge item');
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File) {
    if (!draft?.id) return;
    setUploading(true);
    setError('');
    try {
      const presign = await fetch('/api/attachments/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'knowledge_item',
          entityId: draft.id,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const json = await presign.json();
      if (!presign.ok) throw new Error(json.error || 'Failed to prepare upload');
      const upload = await fetch(json.uploadUrl, {
        method: 'PUT',
        headers: file.type ? { 'Content-Type': file.type } : {},
        body: file,
      });
      if (!upload.ok) throw new Error('Upload failed');
      await loadAttachments(draft.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <ConsolePanel
        title="Knowledge Base"
        description="Company-specific facts, files, guardrails, links, and marketing context the AI Growth Assistant can use."
        icon={Database}
        action={
          <OpsButton type="button" variant="primary" onClick={() => setDraft(emptyDraft())}>
            <Plus className="h-4 w-4" />
            New KB Item
          </OpsButton>
        }
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Items</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{loading ? '...' : stats.total}</p>
          </div>
          <div className="rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Pinned</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{loading ? '...' : stats.pinned}</p>
          </div>
          <div className="rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Guardrails</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{loading ? '...' : stats.guardrails}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <SearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search knowledge..." className="min-w-[min(360px,100%)]" />
          <OpsSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="w-64">
            <option value="all">All types</option>
            {KB_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </OpsSelect>
          <OpsButton type="button" variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </OpsButton>
        </div>

        {error ? (
          <div className="mb-4 rounded-[20px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <EmptyState title="Loading knowledge base" description="Fetching company-specific AI context." />
        ) : items.length === 0 ? (
          <EmptyState
            title="No knowledge items yet"
            description="Add business facts, guardrails, links, files, and voice notes so the assistant can answer like it knows the company."
            action={
              <OpsButton type="button" variant="primary" onClick={() => setDraft(emptyDraft())}>
                <Plus className="h-4 w-4" />
                New KB Item
              </OpsButton>
            }
          />
        ) : (
          <DataTable
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'type', label: 'Type' },
              { key: 'tags', label: 'Tags' },
              { key: 'status', label: 'Status' },
              { key: 'updated', label: 'Updated' },
            ]}
            minWidthClassName="min-w-[900px]"
            className="border-0 shadow-none"
          >
            {items.map((item) => (
              <tr key={item.id} className="cursor-pointer hover:bg-[var(--ops-surface-subtle)]" onClick={() => setDraft(draftFromItem(item))}>
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-[var(--ops-text)]">{item.title}</p>
                  {item.url ? <p className="mt-1 truncate text-xs text-[var(--ops-muted)]">{item.url}</p> : null}
                </td>
                <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{item.item_type}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {(item.tags || []).slice(0, 4).map((tag) => (
                      <StatusBadge key={tag} tone="neutral">{tag}</StatusBadge>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge tone={item.status === 'Active' ? 'success' : item.status === 'Draft' ? 'warning' : 'neutral'}>
                    {item.status}
                  </StatusBadge>
                </td>
                <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{formatDate(item.updated_at)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </ConsolePanel>

      <DetailDrawer
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit knowledge item' : 'New knowledge item'}
        description="This information becomes retrievable context for the AI Growth Assistant."
        footer={
          <div className="flex items-center justify-between gap-3">
            {draft?.id ? (
              <OpsButton type="button" variant="danger" onClick={deleteDraft} disabled={saving}>
                <Trash2 className="h-4 w-4" />
                Delete
              </OpsButton>
            ) : <span />}
            <OpsButton type="button" variant="primary" onClick={saveDraft} disabled={saving || !draft?.title.trim()}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </OpsButton>
          </div>
        }
      >
        {draft ? (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Title</label>
              <OpsInput value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Type</label>
                <OpsSelect value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value })}>
                  {KB_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </OpsSelect>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Status</label>
                <OpsSelect value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  {['Active', 'Draft', 'Archived'].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </OpsSelect>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Body</label>
              <OpsTextarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={8} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">URL / reference</label>
              <OpsInput value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Tags</label>
              <OpsInput value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="pricing, service area, do not say" />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm text-[var(--ops-text)]">
              <input type="checkbox" checked={draft.isPinned} onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })} />
              Pin as high-priority assistant context
            </label>

            <div className="rounded-[24px] border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--ops-text)]">Files / images</h3>
                  <p className="mt-1 text-xs text-[var(--ops-muted)]">
                    Save the item first, then attach files. Full file parsing comes later.
                  </p>
                </div>
                {draft.id ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[var(--ops-border-strong)] bg-[var(--ops-surface-strong)] px-3.5 py-2 text-sm font-semibold text-[var(--ops-text)]">
                    <FileUp className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadFile(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                {attachments.length === 0 ? (
                  <p className="text-sm text-[var(--ops-muted)]">No files attached.</p>
                ) : (
                  attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.publicUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm text-[var(--ops-text)]"
                    >
                      {attachment.file_name || attachment.id}
                    </a>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </>
  );
}
