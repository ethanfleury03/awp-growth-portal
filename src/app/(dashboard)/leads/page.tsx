'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LeadPipelineBoard } from '@/components/awp/lead-pipeline-board';
import {
  AppPageHeader,
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
  opsButtonClass,
} from '@/components/ops/ui';
import {
  awpIntendedUseOptions,
  awpLeadSourceOptions,
  awpLeadTypeOptions,
  awpPipelineStages,
  awpYesNoUnknownOptions,
  sourceFromSlug,
} from '@/lib/awp/config';
import { formatCurrency, formatDateLabel, parseJsonSafely } from '@/lib/ops';
import { CalendarClock, LayoutGrid, Plus, RefreshCw, Save, Search, Trash2, Users } from 'lucide-react';

type Lead = {
  id: string;
  source: string;
  status: string;
  priority?: number;
  issue: string;
  description?: string | null;
  location?: string | null;
  ai_qualification?: string | null;
  ai_score?: number | null;
  lead_context_json?: string | null;
  next_follow_up_at?: string | null;
  last_contacted_at?: string | null;
  estimated_value_cents?: number | null;
  created_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
};

type LeadDraft = {
  id?: string;
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
  last_contacted_at: string;
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

function dateInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function contextForLead(lead: Lead) {
  return parseJsonSafely<Record<string, unknown>>(lead.lead_context_json || '') || {};
}

function createEmptyDraft(): LeadDraft {
  return {
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    issue: '',
    description: '',
    location: '',
    source: 'Website Form',
    status: 'new_lead',
    priority: 3,
    ai_score: 50,
    estimated_value: 0,
    next_follow_up_at: '',
    last_contacted_at: '',
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

function draftFromLead(lead: Lead): LeadDraft {
  const context = contextForLead(lead);
  return {
    id: lead.id,
    customer_name: lead.customer_name || '',
    customer_email: lead.customer_email || '',
    customer_phone: lead.customer_phone || '',
    issue: lead.issue || '',
    description: lead.description || '',
    location: lead.location || '',
    source: sourceFromSlug(lead.source),
    status: lead.status || 'new_lead',
    priority: Number(lead.priority || 3),
    ai_score: Number(lead.ai_score || 50),
    estimated_value: Number(lead.estimated_value_cents || 0) / 100,
    next_follow_up_at: dateInputValue(lead.next_follow_up_at),
    last_contacted_at: dateInputValue(lead.last_contacted_at),
    context: {
      company: String(context.company || ''),
      leadType: String(context.leadType || 'Homeowner'),
      ownsLand: String(context.ownsLand || 'Unknown'),
      hasSiteAccess: String(context.hasSiteAccess || 'Unknown'),
      utilitiesAvailable: String(context.utilitiesAvailable || 'Unknown'),
      intendedUse: String(context.intendedUse || 'Unknown'),
      estimatedBudget: String(context.estimatedBudget || ''),
      timeline: String(context.timeline || ''),
      cabinInterestLevel: String(context.cabinInterestLevel || 'Medium'),
      notes: String(context.notes || ''),
      assignedOwner: String(context.assignedOwner || 'AWP Sales'),
      aiSummary: String(context.aiSummary || lead.ai_qualification || ''),
    },
  };
}

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') === 'pipeline' ? 'pipeline' : 'list';
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [draft, setDraft] = useState<LeadDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/leads?limit=250', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to load leads');
      setLeads(json.leads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredLeads = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return leads.filter((lead) => {
      const context = contextForLead(lead);
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || sourceFromSlug(lead.source) === sourceFilter;
      const matchesSearch =
        !needle ||
        [
          lead.customer_name,
          lead.customer_phone,
          lead.customer_email,
          lead.issue,
          lead.location,
          context.company,
          context.leadType,
          context.intendedUse,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      return matchesStatus && matchesSource && matchesSearch;
    });
  }, [leads, search, sourceFilter, statusFilter]);

  const stats = useMemo(() => {
    const followUpsDue = leads.filter((lead) => {
      if (!lead.next_follow_up_at) return false;
      const date = new Date(lead.next_follow_up_at);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return !Number.isNaN(date.getTime()) && date <= end;
    }).length;
    const proposals = leads.filter((lead) => lead.status === 'proposal_sent').length;
    const won = leads.filter((lead) => lead.status === 'won').length;
    const value = leads
      .filter((lead) => !['lost', 'won'].includes(lead.status))
      .reduce((sum, lead) => sum + Number(lead.estimated_value_cents || 0), 0);

    return {
      total: leads.length,
      qualified: leads.filter((lead) => ['qualified', 'planning_call_scheduled', 'design_layout_discussion'].includes(lead.status)).length,
      followUpsDue,
      proposals,
      won,
      value,
    };
  }, [leads]);

  async function saveLead() {
    if (!draft?.customer_name.trim() || !draft.issue.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/leads', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
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
          last_contacted_at: draft.last_contacted_at ? new Date(`${draft.last_contacted_at}T09:00:00`).toISOString() : null,
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

  async function deleteLead() {
    if (!draft?.id || !confirm(`Delete ${draft.customer_name || draft.issue}?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/leads?id=${encodeURIComponent(draft.id)}`, { method: 'DELETE' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to delete lead');
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete lead');
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(lead: Lead, status: string) {
    setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, status } : item)));
    try {
      await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, status }),
      });
    } catch {
      load();
    }
  }

  function updateContext(key: keyof LeadDraft['context'], value: string) {
    if (!draft) return;
    setDraft({ ...draft, context: { ...draft.context, [key]: value } });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
          <AppPageHeader
            icon={Users}
            eyebrow="Cabin Buyer Leads"
            title="Cabin Buyer Leads"
            description="Manage cabin opportunities in a focused list view or visual pipeline view."
            actions={
              <>
                <Link href="/leads" className={opsButtonClass(view === 'list' ? 'primary' : 'secondary')}>
                  <Users className="h-4 w-4" />
                  List
                </Link>
                <Link href="/leads?view=pipeline" className={opsButtonClass(view === 'pipeline' ? 'primary' : 'secondary')}>
                  <LayoutGrid className="h-4 w-4" />
                  Pipeline
                </Link>
                {view === 'list' ? (
                  <>
                    <SearchField
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search cabin leads..."
                      className="min-w-[min(360px,100%)]"
                    />
                    <OpsButton type="button" variant="secondary" onClick={load}>
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </OpsButton>
                    <OpsButton type="button" variant="primary" onClick={() => setDraft(createEmptyDraft())}>
                      <Plus className="h-4 w-4" />
                      New Lead
                    </OpsButton>
                  </>
                ) : null}
              </>
            }
          />

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          {view === 'pipeline' ? (
            <LeadPipelineBoard />
          ) : (
            <>
              <KpiStrip className="xl:grid-cols-6">
                <StatCard label="Total Leads" value={loading ? '...' : stats.total} meta="All cabin and partner opportunities" tone="brand" icon={Users} />
                <StatCard label="Qualified" value={loading ? '...' : stats.qualified} meta="Ready for planning/design" tone="success" icon={Search} />
                <StatCard label="Follow-Ups Due" value={loading ? '...' : stats.followUpsDue} meta="Due today or earlier" tone="danger" icon={CalendarClock} />
                <StatCard label="Proposals Sent" value={loading ? '...' : stats.proposals} meta="Waiting on decision" tone="warning" icon={Save} />
                <StatCard label="Won Projects" value={loading ? '...' : stats.won} meta="Closed opportunities" tone="success" icon={Users} />
                <StatCard label="Pipeline Value" value={loading ? '...' : formatCurrency(stats.value, { cents: true })} meta="Estimated open value" tone="neutral" icon={Users} />
              </KpiStrip>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-4 shadow-[var(--ops-shadow-soft)]">
                <div className="flex flex-wrap gap-3">
                  <OpsSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-56">
                    <option value="all">All pipeline stages</option>
                    {awpPipelineStages.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </OpsSelect>
                  <OpsSelect value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="w-56">
                    <option value="all">All sources</option>
                    {awpLeadSourceOptions.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </OpsSelect>
                </div>
                <Link href="/leads?view=pipeline" className="text-sm font-semibold text-[var(--ops-brand)] hover:underline">
                  Open Pipeline View
                </Link>
              </div>

              {loading ? (
                <EmptyState title="Loading leads" description="Fetching the AWP cabin lead list." />
              ) : filteredLeads.length === 0 ? (
                <EmptyState
                  title="No leads found"
                  description="Create a new cabin lead or adjust the current filters."
                  action={
                    <OpsButton type="button" variant="primary" onClick={() => setDraft(createEmptyDraft())}>
                      <Plus className="h-4 w-4" />
                      New Lead
                    </OpsButton>
                  }
                />
              ) : (
                <DataTable
              columns={[
                { key: 'lead', label: 'Lead' },
                { key: 'type', label: 'Lead Type' },
                { key: 'source', label: 'Source' },
                { key: 'stage', label: 'Stage' },
                { key: 'site', label: 'Site Readiness' },
                { key: 'budget', label: 'Budget / Value' },
                { key: 'followup', label: 'Next Follow-Up' },
              ]}
              footer={`Showing ${filteredLeads.length} of ${leads.length} leads`}
              minWidthClassName="min-w-[1180px]"
            >
              {filteredLeads.map((lead) => {
                const context = contextForLead(lead);
                return (
                  <tr key={lead.id} className="transition-colors hover:bg-[var(--ops-surface-subtle)]">
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => setDraft(draftFromLead(lead))} className="text-left">
                        <p className="text-sm font-semibold text-[var(--ops-text)] hover:text-[var(--ops-brand)]">{lead.customer_name || 'Cabin lead'}</p>
                        <p className="mt-1 text-xs text-[var(--ops-muted)]">{lead.customer_phone || lead.customer_email || '-'}</p>
                      </button>
                      <p className="mt-2 text-xs font-medium text-[var(--ops-muted)]">{lead.issue}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">
                      <p className="font-semibold text-[var(--ops-text)]">{String(context.leadType || '-')}</p>
                      <p className="mt-1 text-xs">{String(context.intendedUse || '-')}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{sourceFromSlug(lead.source)}</td>
                    <td className="px-5 py-4">
                      <OpsSelect value={lead.status} onChange={(event) => quickStatus(lead, event.target.value)} className="min-w-56">
                        {awpPipelineStages.map((stage) => (
                          <option key={stage.value} value={stage.value}>
                            {stage.label}
                          </option>
                        ))}
                      </OpsSelect>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone={context.ownsLand === 'Yes' ? 'success' : 'neutral'}>Land: {String(context.ownsLand || 'Unknown')}</StatusBadge>
                        <StatusBadge tone={context.hasSiteAccess === 'Yes' ? 'success' : 'neutral'}>Access: {String(context.hasSiteAccess || 'Unknown')}</StatusBadge>
                        <StatusBadge tone={context.utilitiesAvailable === 'Yes' ? 'success' : 'neutral'}>Utilities: {String(context.utilitiesAvailable || 'Unknown')}</StatusBadge>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">
                      <p>{String(context.estimatedBudget || '-')}</p>
                      <p className="mt-1 font-semibold text-[var(--ops-text)]">{formatCurrency(lead.estimated_value_cents || 0, { cents: true })}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-2">
                        <StatusBadge tone={lead.next_follow_up_at ? 'warning' : 'neutral'}>{formatDateLabel(lead.next_follow_up_at)}</StatusBadge>
                        <p className="text-xs text-[var(--ops-muted)]">Score {lead.ai_score || '-'}</p>
                      </div>
                    </td>
                  </tr>
                );
              })}
                </DataTable>
              )}
            </>
          )}
        </div>
      </main>

      <DetailDrawer
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit cabin lead' : 'New cabin lead'}
        description="Capture cabin project fit, site readiness, timeline, follow-up, and AI summary details."
        footer={
          <div className="flex items-center justify-between gap-3">
            {draft?.id ? (
              <OpsButton type="button" variant="danger" onClick={deleteLead} disabled={saving}>
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
              <OpsButton type="button" variant="primary" onClick={saveLead} disabled={saving || !draft?.customer_name.trim() || !draft?.issue.trim()}>
                {saving ? 'Saving...' : 'Save lead'}
              </OpsButton>
            </div>
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
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Timeline</label>
                <OpsInput value={draft.context.timeline} onChange={(event) => updateContext('timeline', event.target.value)} placeholder="3-9 months" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Cabin interest level</label>
                <OpsSelect value={draft.context.cabinInterestLevel} onChange={(event) => updateContext('cabinInterestLevel', event.target.value)}>
                  {['Low', 'Medium', 'High', 'Very High'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </OpsSelect>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Pipeline stage</label>
                <OpsSelect value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  {awpPipelineStages.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </OpsSelect>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Assigned owner</label>
                <OpsInput value={draft.context.assignedOwner} onChange={(event) => updateContext('assignedOwner', event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Next follow-up date</label>
                <OpsInput type="date" value={draft.next_follow_up_at} onChange={(event) => setDraft({ ...draft, next_follow_up_at: event.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Last contacted date</label>
                <OpsInput type="date" value={draft.last_contacted_at} onChange={(event) => setDraft({ ...draft, last_contacted_at: event.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Lead score</label>
                <OpsInput type="number" min={1} max={100} value={draft.ai_score} onChange={(event) => setDraft({ ...draft, ai_score: Number(event.target.value || 0) })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">AI summary</label>
                <OpsTextarea value={draft.context.aiSummary} onChange={(event) => updateContext('aiSummary', event.target.value)} rows={3} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Internal qualification notes</label>
              <OpsTextarea value={draft.context.notes} onChange={(event) => updateContext('notes', event.target.value)} rows={4} />
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
