'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DetailDrawer,
  EmptyState,
  OpsButton,
  OpsInput,
  OpsSelect,
  OpsTextarea,
  SearchField,
  StatusBadge,
} from '@/components/ops/ui';
import {
  awpIntendedUseOptions,
  awpLeadSourceOptions,
  awpLeadTypeOptions,
  awpYesNoUnknownOptions,
  sourceFromSlug,
  sourceToSlug,
} from '@/lib/awp/config';
import { formatCurrency, formatDateLabel, parseJsonSafely } from '@/lib/ops';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  GripVertical,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';

type Lead = {
  id: string;
  source: string;
  status: string;
  issue: string;
  location?: string | null;
  ai_score?: number | null;
  created_at: string;
  next_follow_up_at?: string | null;
  estimated_value_cents?: number | null;
  lead_context_json?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
};

type Bucket = {
  id: string;
  title: string;
  color?: string | null;
  position: number;
};

type Stage = Bucket & {
  value: string;
  color: string;
};

type LeadDraft = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  issue: string;
  description: string;
  location: string;
  source: string;
  status: string;
  priority: number;
  ai_score: number;
  estimated_value: number;
  next_follow_up_at: string;
  context: {
    company: string;
    leadType: string;
    ownsLand: string;
    hasSiteAccess: string;
    utilitiesAvailable: string;
    intendedUse: string;
    estimatedBudget: string;
    timeline: string;
    cabinInterestLevel: string;
    notes: string;
    assignedOwner: string;
    aiSummary: string;
  };
};

type BucketForm = {
  id?: string;
  title: string;
  color: string;
};

const DEFAULT_BUCKET_COLOR = '#2f6f53';

function contextForLead(lead: Lead) {
  return parseJsonSafely<Record<string, unknown>>(lead.lead_context_json || '') || {};
}

function createEmptyDraft(status: string): LeadDraft {
  return {
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    issue: '',
    description: '',
    location: '',
    source: 'Website Form',
    status,
    priority: 3,
    ai_score: 50,
    estimated_value: 0,
    next_follow_up_at: '',
    context: {
      company: '',
      leadType: 'Homeowner',
      ownsLand: 'Unknown',
      hasSiteAccess: 'Unknown',
      utilitiesAvailable: 'Unknown',
      intendedUse: 'Unknown',
      estimatedBudget: '',
      timeline: '',
      cabinInterestLevel: 'Medium',
      notes: '',
      assignedOwner: 'AWP Sales',
      aiSummary: '',
    },
  };
}

function normalizeBucket(bucket: Bucket): Stage {
  return {
    ...bucket,
    value: sourceToSlug(bucket.title),
    color: bucket.color || DEFAULT_BUCKET_COLOR,
  };
}

function compactLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LeadPipelineBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LeadDraft | null>(null);
  const [bucketManagerOpen, setBucketManagerOpen] = useState(false);
  const [bucketForm, setBucketForm] = useState<BucketForm>({
    title: '',
    color: DEFAULT_BUCKET_COLOR,
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [leadResponse, bucketResponse] = await Promise.all([
        fetch('/api/leads?limit=300', { cache: 'no-store' }),
        fetch('/api/buckets', { cache: 'no-store' }),
      ]);
      const leadJson = await leadResponse.json();
      const bucketJson = await bucketResponse.json();
      if (!leadResponse.ok) throw new Error(leadJson.error || 'Failed to load pipeline');
      if (!bucketResponse.ok) throw new Error(bucketJson.error || 'Failed to load buckets');
      setLeads(leadJson.leads || []);
      setBuckets(bucketJson.buckets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stages = useMemo(
    () => [...buckets].sort((a, b) => a.position - b.position).map(normalizeBucket),
    [buckets],
  );
  const fallbackStage = stages[0]?.value || 'new_lead';
  const stageValues = useMemo(() => new Set(stages.map((stage) => stage.value)), [stages]);

  const filteredLeads = useMemo(() => {
    const needle = search.toLowerCase().trim();
    if (!needle) return leads;
    return leads.filter((lead) => {
      const context = contextForLead(lead);
      return [
        lead.customer_name,
        lead.customer_phone,
        lead.customer_email,
        lead.issue,
        lead.location,
        context.leadType,
        context.intendedUse,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [leads, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const stage of stages) map.set(stage.value, []);
    for (const lead of filteredLeads) {
      const status = stageValues.has(lead.status) ? lead.status : fallbackStage;
      map.get(status)?.push(lead);
    }
    return map;
  }, [fallbackStage, filteredLeads, stageValues, stages]);

  const totals = useMemo(() => {
    const closedStageValues = new Set(
      stages
        .filter((stage) => /won|lost|closed/i.test(stage.title))
        .map((stage) => stage.value),
    );
    const proposalStageValues = new Set(
      stages
        .filter((stage) => /proposal|quote|estimate/i.test(stage.title))
        .map((stage) => stage.value),
    );
    const followUpStageValues = new Set(
      stages
        .filter((stage) => /follow|nurture/i.test(stage.title))
        .map((stage) => stage.value),
    );
    const open = leads.filter((lead) => !closedStageValues.has(lead.status));
    return {
      open: open.length,
      value: open.reduce((sum, lead) => sum + Number(lead.estimated_value_cents || 0), 0),
      buckets: stages.length,
      proposals: leads.filter((lead) => proposalStageValues.has(lead.status)).length,
      followUps: leads.filter((lead) => followUpStageValues.has(lead.status)).length,
    };
  }, [leads, stages]);

  function labelForStatus(status: string) {
    return stages.find((stage) => stage.value === status)?.title || compactLabel(status || fallbackStage);
  }

  async function moveLead(leadId: string, status: string) {
    const previous = leads;
    setLeads((current) => current.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)));
    setSaving(true);
    try {
      const response = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to update lead stage');
    } catch (err) {
      setLeads(previous);
      setError(err instanceof Error ? err.message : 'Failed to update lead stage');
    } finally {
      setSaving(false);
      setDraggedLeadId(null);
    }
  }

  async function deleteLead(lead: Lead) {
    const leadLabel = lead.customer_name || lead.issue || 'this lead';
    if (!confirm(`Delete "${leadLabel}" from the CRM pipeline?`)) return;

    const previous = leads;
    setLeads((current) => current.filter((item) => item.id !== lead.id));
    setDeletingLeadId(lead.id);
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/leads?id=${encodeURIComponent(lead.id)}`, {
        method: 'DELETE',
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Failed to delete lead');
    } catch (err) {
      setLeads(previous);
      setError(err instanceof Error ? err.message : 'Failed to delete lead');
    } finally {
      setDeletingLeadId(null);
      setSaving(false);
    }
  }

  function updateContext(key: keyof LeadDraft['context'], value: string) {
    if (!draft) return;
    setDraft({ ...draft, context: { ...draft.context, [key]: value } });
  }

  async function saveLead() {
    if (!draft?.customer_name.trim() || !draft.issue.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: draft.customer_name,
          customer_email: draft.customer_email,
          customer_phone: draft.customer_phone,
          issue: draft.issue,
          description: draft.description,
          location: draft.location,
          source: draft.source,
          status: draft.status,
          priority: draft.priority,
          ai_score: draft.ai_score,
          ai_summary: draft.context.aiSummary,
          lead_context_json: JSON.stringify(draft.context),
          next_follow_up_at: draft.next_follow_up_at ? new Date(`${draft.next_follow_up_at}T09:00:00`).toISOString() : null,
          estimated_value_cents: Math.round(Number(draft.estimated_value || 0) * 100),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to save lead');
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  }

  function resetBucketForm() {
    setBucketForm({ title: '', color: DEFAULT_BUCKET_COLOR });
  }

  async function saveBucket() {
    const title = bucketForm.title.trim();
    if (!title) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/buckets', {
        method: bucketForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bucketForm.id,
          title,
          color: bucketForm.color,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to save bucket');
      resetBucketForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bucket');
    } finally {
      setSaving(false);
    }
  }

  async function reorderBucket(bucketId: string, direction: -1 | 1) {
    const order = stages.map((stage) => stage.id);
    const index = order.indexOf(bucketId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/buckets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to reorder buckets');
      setBuckets(json.buckets || buckets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder buckets');
    } finally {
      setSaving(false);
    }
  }

  async function deleteBucket(bucket: Stage) {
    const target = stages.find((stage) => stage.id !== bucket.id);
    if (!target) {
      setError('Keep at least one CRM bucket.');
      return;
    }
    if (!confirm(`Delete "${bucket.title}"? Leads in this bucket will move to "${target.title}".`)) return;

    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        `/api/buckets?id=${encodeURIComponent(bucket.id)}&moveTo=${encodeURIComponent(target.id)}`,
        { method: 'DELETE' },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to delete bucket');
      resetBucketForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bucket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-3 shadow-[var(--ops-shadow-soft)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Open Leads', loading ? '...' : totals.open],
                ['Open Value', loading ? '...' : formatCurrency(totals.value, { cents: true })],
                ['Buckets', loading ? '...' : totals.buckets],
                ['Follow-Ups', loading ? '...' : totals.followUps],
              ].map(([label, value]) => (
                <div key={label} className="min-w-[8rem] rounded-lg bg-[var(--ops-surface-subtle)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-[var(--ops-text)]">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SearchField
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search pipeline..."
                className="min-w-[min(320px,100%)]"
              />
              <OpsButton type="button" variant="secondary" size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </OpsButton>
              <OpsButton type="button" variant="secondary" size="sm" onClick={() => setBucketManagerOpen(true)}>
                <Settings2 className="h-4 w-4" />
                Buckets
              </OpsButton>
              <OpsButton type="button" variant="primary" size="sm" onClick={() => setDraft(createEmptyDraft(fallbackStage))}>
                <Plus className="h-4 w-4" />
                Add Lead
              </OpsButton>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
            {error}
          </div>
        ) : null}
        {saving && !draft ? <p className="text-sm text-[var(--ops-muted)]">Saving...</p> : null}

        {loading ? (
          <EmptyState title="Loading pipeline" description="Fetching cabin CRM buckets and leads." />
        ) : stages.length === 0 ? (
          <EmptyState
            title="No buckets yet"
            description="Create your first CRM bucket to start organizing opportunities."
            action={
              <OpsButton type="button" variant="primary" onClick={() => setBucketManagerOpen(true)}>
                <Settings2 className="h-4 w-4" />
                Manage buckets
              </OpsButton>
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-x-auto pb-2">
            <div className="flex h-[clamp(360px,calc(100vh-340px),640px)] gap-3 pr-3">
              {stages.map((stage) => {
                const stageLeads = grouped.get(stage.value) || [];
                return (
                  <section
                    key={stage.id}
                    className="flex w-[16.5rem] shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] shadow-[var(--ops-shadow-soft)]"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedLeadId) moveLead(draggedLeadId, stage.value);
                    }}
                  >
                    <div className="border-b border-[var(--ops-border)] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                          <h2 className="truncate text-sm font-semibold text-[var(--ops-text)]">{stage.title}</h2>
                        </div>
                        <span className="rounded-full bg-[var(--ops-surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--ops-muted)]">
                          {stageLeads.length}
                        </span>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                      {stageLeads.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[var(--ops-border-strong)] bg-[var(--ops-surface-subtle)] px-3 py-4 text-center text-xs text-[var(--ops-muted)]">
                          Drop here
                        </div>
                      ) : (
                        stageLeads.map((lead) => {
                          const context = contextForLead(lead);
                          return (
                            <article
                              key={lead.id}
                              draggable
                              onDragStart={() => setDraggedLeadId(lead.id)}
                              className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface)] p-2.5 shadow-[var(--ops-shadow-soft)] transition hover:border-[var(--ops-border-strong)]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <Link href={`/crm/leads/${lead.id}`} className="block truncate text-sm font-semibold text-[var(--ops-text)] hover:text-[var(--ops-brand)]">
                                    {lead.customer_name || 'Cabin lead'}
                                  </Link>
                                  <p className="mt-0.5 truncate text-xs text-[var(--ops-muted)]">
                                    {lead.customer_phone || lead.customer_email || sourceFromSlug(lead.source)}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    title="Delete lead"
                                    aria-label={`Delete ${lead.customer_name || 'lead'}`}
                                    disabled={deletingLeadId === lead.id}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void deleteLead(lead);
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-md text-[var(--ops-muted)] transition hover:bg-[var(--ops-danger-soft)] hover:text-[var(--ops-danger-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  <GripVertical className="h-4 w-4 text-[var(--ops-muted)]" />
                                </div>
                              </div>

                              <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-5 text-[var(--ops-text)]">{lead.issue}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ops-muted)]">
                                {String(context.aiSummary || context.notes || lead.location || 'No summary yet.')}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <span
                                  className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                                  style={{
                                    borderColor: `${stage.color}55`,
                                    backgroundColor: `${stage.color}14`,
                                    color: stage.color,
                                  }}
                                >
                                  {labelForStatus(lead.status)}
                                </span>
                                <StatusBadge tone="neutral" className="py-0.5">{String(context.leadType || 'Lead')}</StatusBadge>
                                {lead.ai_score ? <StatusBadge tone="success" className="py-0.5">Score {lead.ai_score}</StatusBadge> : null}
                              </div>

                              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-[var(--ops-muted)]">
                                <div>
                                  <p className="font-semibold text-[var(--ops-text)]">{formatCurrency(lead.estimated_value_cents || 0, { cents: true })}</p>
                                  <p>Value</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-[var(--ops-text)]">{formatDateLabel(lead.next_follow_up_at)}</p>
                                  <p>Follow-up</p>
                                </div>
                              </div>

                              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[var(--ops-muted)]">
                                <CalendarClock className="h-3.5 w-3.5" />
                                <span className="truncate">{formatDateLabel(lead.created_at)} / {sourceFromSlug(lead.source)}</span>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <DetailDrawer
        open={bucketManagerOpen}
        onClose={() => {
          setBucketManagerOpen(false);
          resetBucketForm();
        }}
        title="Manage CRM buckets"
        description="Create, rename, recolor, reorder, and delete pipeline buckets for this client workspace."
        footer={
          <div className="flex justify-end">
            <OpsButton type="button" variant="secondary" onClick={() => setBucketManagerOpen(false)}>
              Done
            </OpsButton>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-3">
            <div className="grid gap-3 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-end">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[var(--ops-muted)]">Color</span>
                <input
                  type="color"
                  value={bucketForm.color}
                  onChange={(event) => setBucketForm({ ...bucketForm, color: event.target.value })}
                  className="h-11 w-14 cursor-pointer rounded-xl border border-[var(--ops-border)] bg-transparent p-1"
                />
              </label>
              <div>
                <label className="mb-2 block text-xs font-semibold text-[var(--ops-muted)]">Bucket name</label>
                <OpsInput
                  value={bucketForm.title}
                  onChange={(event) => setBucketForm({ ...bucketForm, title: event.target.value })}
                  placeholder="Example: Ready for Site Visit"
                />
              </div>
              <div className="flex gap-2">
                {bucketForm.id ? (
                  <OpsButton type="button" variant="secondary" size="sm" onClick={resetBucketForm}>
                    <X className="h-4 w-4" />
                    Cancel
                  </OpsButton>
                ) : null}
                <OpsButton type="button" variant="primary" size="sm" onClick={saveBucket} disabled={saving || !bucketForm.title.trim()}>
                  {bucketForm.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {bucketForm.id ? 'Save' : 'Add'}
                </OpsButton>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {stages.map((bucket, index) => (
                <div key={bucket.id} className="flex items-center gap-2 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface)] p-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: bucket.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{bucket.title}</p>
                  <p className="text-xs text-[var(--ops-muted)]">{grouped.get(bucket.value)?.length || 0} leads</p>
                </div>
                <OpsButton type="button" variant="ghost" size="sm" onClick={() => reorderBucket(bucket.id, -1)} disabled={index === 0 || saving}>
                  <ArrowLeft className="h-4 w-4" />
                </OpsButton>
                <OpsButton type="button" variant="ghost" size="sm" onClick={() => reorderBucket(bucket.id, 1)} disabled={index === stages.length - 1 || saving}>
                  <ArrowRight className="h-4 w-4" />
                </OpsButton>
                <OpsButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setBucketForm({ id: bucket.id, title: bucket.title, color: bucket.color })}
                >
                  Rename
                </OpsButton>
                <OpsButton type="button" variant="danger" size="sm" onClick={() => deleteBucket(bucket)} disabled={stages.length <= 1 || saving}>
                  <Trash2 className="h-4 w-4" />
                </OpsButton>
              </div>
            ))}
          </div>
        </div>
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title="New cabin opportunity"
        description="Capture the buyer, project fit, site readiness, budget, and next follow-up."
        footer={
          <div className="flex justify-end gap-3">
            <OpsButton type="button" variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </OpsButton>
            <OpsButton type="button" variant="primary" onClick={saveLead} disabled={saving || !draft?.customer_name.trim() || !draft?.issue.trim()}>
              {saving ? 'Saving...' : 'Save lead'}
            </OpsButton>
          </div>
        }
      >
        {draft ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Full name</label>
                <OpsInput value={draft.customer_name} onChange={(event) => setDraft({ ...draft, customer_name: event.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Company, if applicable</label>
                <OpsInput value={draft.context.company} onChange={(event) => updateContext('company', event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Email</label>
                <OpsInput type="email" value={draft.customer_email} onChange={(event) => setDraft({ ...draft, customer_email: event.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Phone</label>
                <OpsInput value={draft.customer_phone} onChange={(event) => setDraft({ ...draft, customer_phone: event.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Cabin interest / project summary</label>
              <OpsInput value={draft.issue} onChange={(event) => setDraft({ ...draft, issue: event.target.value })} placeholder="Second home near Lake Placid" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Notes</label>
              <OpsTextarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Lead type</label>
                <OpsSelect value={draft.context.leadType} onChange={(event) => updateContext('leadType', event.target.value)}>
                  {awpLeadTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </OpsSelect>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Lead source</label>
                <OpsSelect value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })}>
                  {awpLeadSourceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </OpsSelect>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Project location</label>
                <OpsInput value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Intended use</label>
                <OpsSelect value={draft.context.intendedUse} onChange={(event) => updateContext('intendedUse', event.target.value)}>
                  {awpIntendedUseOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </OpsSelect>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Owns land?</label>
                <OpsSelect value={draft.context.ownsLand} onChange={(event) => updateContext('ownsLand', event.target.value)}>
                  {awpYesNoUnknownOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </OpsSelect>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Has site access?</label>
                <OpsSelect value={draft.context.hasSiteAccess} onChange={(event) => updateContext('hasSiteAccess', event.target.value)}>
                  {awpYesNoUnknownOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </OpsSelect>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Utilities available?</label>
                <OpsSelect value={draft.context.utilitiesAvailable} onChange={(event) => updateContext('utilitiesAvailable', event.target.value)}>
                  {awpYesNoUnknownOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </OpsSelect>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Estimated budget</label>
                <OpsInput value={draft.context.estimatedBudget} onChange={(event) => updateContext('estimatedBudget', event.target.value)} placeholder="$250k-$350k" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Estimated pipeline value</label>
                <OpsInput type="number" value={draft.estimated_value} onChange={(event) => setDraft({ ...draft, estimated_value: Number(event.target.value || 0) })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Pipeline bucket</label>
                <OpsSelect value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.value}>
                      {stage.title}
                    </option>
                  ))}
                </OpsSelect>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Next follow-up date</label>
                <OpsInput type="date" value={draft.next_follow_up_at} onChange={(event) => setDraft({ ...draft, next_follow_up_at: event.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">AI summary / internal qualification notes</label>
              <OpsTextarea value={draft.context.aiSummary} onChange={(event) => updateContext('aiSummary', event.target.value)} rows={4} />
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </>
  );
}
