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
import { KNOWLEDGE_CONFIDENCE_LEVELS } from '@/lib/ai/knowledge-types';
import { Archive, Blocks, FileText, FileUp, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

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
  attachmentCount?: number;
  sourceMetadata?: {
    source?: string;
    purpose?: string;
    confidence?: string;
    aiUse?: string;
    owner?: string;
  };
};

type Attachment = {
  id: string;
  file_name?: string;
  mime_type?: string;
  size_bytes?: number | null;
  publicUrl?: string | null;
};

type Draft = {
  id?: string;
  title: string;
  source: string;
  purpose: string;
  body: string;
  aiUse: string;
  owner: string;
  confidence: string;
  status: string;
  url: string;
  tags: string;
  isPinned: boolean;
};

function emptyDraft(): Draft {
  return {
    title: '',
    source: '',
    purpose: '',
    body: '',
    aiUse: '',
    owner: '',
    confidence: 'Verified',
    status: 'Active',
    url: '',
    tags: 'reusable architecture',
    isPinned: true,
  };
}

function draftFromItem(item: KnowledgeItem): Draft {
  return {
    id: item.id,
    title: item.title,
    source: item.sourceMetadata?.source || item.url || '',
    purpose: item.sourceMetadata?.purpose || '',
    body: item.body || '',
    aiUse: item.sourceMetadata?.aiUse || '',
    owner: item.sourceMetadata?.owner || '',
    confidence: item.sourceMetadata?.confidence || 'Verified',
    status: item.status || 'Active',
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

function formatBytes(value?: number | null) {
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReusableArchitecturePanel() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        type: 'Reusable Architecture',
        status: 'all',
      });
      if (search.trim()) params.set('q', search.trim());
      const response = await fetch(`/api/knowledge?${params.toString()}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to load reusable architecture');
      setItems(json.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reusable architecture');
    } finally {
      setLoading(false);
    }
  }, [search]);

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
      active: items.filter((item) => item.status === 'Active').length,
      files: items.reduce((sum, item) => sum + Number(item.attachmentCount || 0), 0),
      stale: items.filter((item) => item.sourceMetadata?.confidence === 'Stale').length,
    }),
    [items],
  );

  async function saveDraft() {
    if (!draft?.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: draft.title,
        itemType: 'Reusable Architecture',
        status: draft.status,
        body: draft.body,
        url: draft.url || draft.source,
        tags: draft.tags,
        isPinned: draft.isPinned,
        sourceMetadata: {
          source: draft.source,
          purpose: draft.purpose,
          confidence: draft.confidence,
          aiUse: draft.aiUse,
          owner: draft.owner,
        },
      };
      const response = await fetch(draft.id ? `/api/knowledge/${draft.id}` : '/api/knowledge', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to save artifact');
      setDraft(draftFromItem(json.item));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save artifact');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!draft?.id || !confirm(`Delete ${draft.title}? Attached file records will be removed too.`)) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/knowledge/${draft.id}`, { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Failed to delete artifact');
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete artifact');
    } finally {
      setSaving(false);
    }
  }

  async function uploadViaLocalApi(file: File, entityId: string) {
    const form = new FormData();
    form.set('entityType', 'knowledge_item');
    form.set('entityId', entityId);
    form.set('file', file);
    const response = await fetch('/api/attachments', { method: 'POST', body: form });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to upload file');
  }

  async function uploadOneFile(file: File, entityId: string) {
    const presign = await fetch('/api/attachments/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'knowledge_item',
        entityId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });
    const json = await presign.json();
    if (!presign.ok) {
      if (presign.status === 503) {
        await uploadViaLocalApi(file, entityId);
        return;
      }
      throw new Error(json.error || 'Failed to prepare upload');
    }

    const upload = await fetch(json.uploadUrl, {
      method: 'PUT',
      headers: file.type ? { 'Content-Type': file.type } : {},
      body: file,
    });
    if (!upload.ok) throw new Error('Upload failed');
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!draft?.id || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        await uploadOneFile(file, draft.id);
      }
      await loadAttachments(draft.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }

  async function deleteAttachment(id: string) {
    if (!draft?.id || !confirm('Delete this file?')) return;
    setUploading(true);
    setError('');
    try {
      const response = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Failed to delete file');
      await loadAttachments(draft.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <ConsolePanel
        title="Reusable Architecture"
        description="Reusable client-specific operating rules, system artifacts, source documents, and AI decision context."
        icon={Blocks}
        action={
          <div className="flex flex-wrap gap-2">
            <OpsButton type="button" variant="secondary" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </OpsButton>
            <OpsButton type="button" variant="primary" onClick={() => setDraft(emptyDraft())}>
              <Plus className="h-4 w-4" />
              New Artifact
            </OpsButton>
          </div>
        }
      >
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          {[
            ['Artifacts', stats.total],
            ['Active', stats.active],
            ['Files', stats.files],
            ['Stale', stats.stale],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{loading ? '...' : value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <SearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search artifacts..." className="min-w-[min(420px,100%)]" />
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <EmptyState title="Loading reusable architecture" description="Fetching AI-ready architecture artifacts." />
        ) : items.length === 0 ? (
          <EmptyState
            title="No reusable architecture yet"
            description="Create artifacts for rules, defaults, decision criteria, prompts, source docs, and reusable client context."
            action={
              <OpsButton type="button" variant="primary" onClick={() => setDraft(emptyDraft())}>
                <Plus className="h-4 w-4" />
                New Artifact
              </OpsButton>
            }
          />
        ) : (
          <DataTable
            columns={[
              { key: 'artifact', label: 'Artifact' },
              { key: 'source', label: 'Source' },
              { key: 'purpose', label: 'Purpose' },
              { key: 'status', label: 'Status' },
              { key: 'files', label: 'Files' },
              { key: 'updated', label: 'Updated' },
            ]}
            minWidthClassName="min-w-[980px]"
            className="border-0 shadow-none"
          >
            {items.map((item) => (
              <tr key={item.id} className="cursor-pointer hover:bg-[var(--ops-surface-subtle)]" onClick={() => setDraft(draftFromItem(item))}>
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-[var(--ops-text)]">{item.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.is_pinned ? <StatusBadge tone="brand">AI pinned</StatusBadge> : null}
                    {item.sourceMetadata?.confidence ? <StatusBadge tone={item.sourceMetadata.confidence === 'Stale' ? 'warning' : 'success'}>{item.sourceMetadata.confidence}</StatusBadge> : null}
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{item.sourceMetadata?.source || item.url || '-'}</td>
                <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{item.sourceMetadata?.purpose || '-'}</td>
                <td className="px-5 py-4">
                  <StatusBadge tone={item.status === 'Active' ? 'success' : item.status === 'Draft' ? 'warning' : 'neutral'}>
                    {item.status}
                  </StatusBadge>
                </td>
                <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{item.attachmentCount || 0}</td>
                <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{formatDate(item.updated_at)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </ConsolePanel>

      <DetailDrawer
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit architecture artifact' : 'New architecture artifact'}
        description="These artifacts are retrieved by the AI assistant as durable client decision context."
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
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Artifact name</label>
              <OpsInput value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Business profile, services, proposal rules" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Source / system of record</label>
                <OpsInput value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder="Internal doc, price sheet, src/lib/..." />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Purpose</label>
                <OpsInput value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} placeholder="How the AI should use this artifact" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Confidence</label>
                <OpsSelect value={draft.confidence} onChange={(event) => setDraft({ ...draft, confidence: event.target.value })}>
                  {KNOWLEDGE_CONFIDENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
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
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">AI usage rule</label>
              <OpsTextarea value={draft.aiUse} onChange={(event) => setDraft({ ...draft, aiUse: event.target.value })} rows={3} placeholder="When answering or drafting, prefer this artifact for..." />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Details / decision guidance</label>
              <OpsTextarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={7} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Reference URL</label>
                <OpsInput value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Owner</label>
                <OpsInput value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} placeholder="Sales, owner, ops, marketing" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Tags</label>
              <OpsInput value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="pricing, cabin models, proposal, guardrail" />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm text-[var(--ops-text)]">
              <input type="checkbox" checked={draft.isPinned} onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })} />
              Pin as high-priority AI decision context
            </label>

            <div className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--ops-text)]">Artifact files</h3>
                  <p className="mt-1 text-xs text-[var(--ops-muted)]">Attach source documents, price sheets, PDFs, images, and spreadsheets.</p>
                </div>
                {draft.id ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--ops-border-strong)] bg-[var(--ops-surface-strong)] px-3.5 py-2 text-sm font-semibold text-[var(--ops-text)]">
                    <FileUp className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload files'}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(event) => {
                        const files = event.target.files;
                        if (files?.length) uploadFiles(files);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                ) : (
                  <StatusBadge tone="neutral">Save first</StatusBadge>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {!draft.id ? (
                  <p className="text-sm text-[var(--ops-muted)]">Save the artifact before attaching files.</p>
                ) : attachments.length === 0 ? (
                  <p className="text-sm text-[var(--ops-muted)]">No files attached.</p>
                ) : (
                  attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm text-[var(--ops-text)]">
                      <a href={attachment.publicUrl || '#'} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 hover:text-[var(--ops-brand)]">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--ops-muted)]" />
                        <span className="truncate">{attachment.file_name || attachment.id}</span>
                        {attachment.size_bytes ? <span className="shrink-0 text-xs text-[var(--ops-muted)]">{formatBytes(attachment.size_bytes)}</span> : null}
                      </a>
                      <OpsButton type="button" variant="ghost" size="sm" onClick={() => deleteAttachment(attachment.id)} disabled={uploading}>
                        <Trash2 className="h-4 w-4" />
                      </OpsButton>
                    </div>
                  ))
                )}
              </div>
            </div>

            {draft.status === 'Archived' ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm text-[var(--ops-muted)]">
                <Archive className="h-4 w-4" />
                Archived artifacts stay stored but are not used by the AI assistant.
              </div>
            ) : null}
          </div>
        ) : null}
      </DetailDrawer>
    </>
  );
}
