'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  OpsButton,
  SearchField,
  StatusBadge,
  opsButtonClass,
} from '@/components/ops/ui';
import { awpPipelineStages, pipelineLabel, sourceFromSlug } from '@/lib/awp/config';
import { formatCurrency, formatDateLabel, parseJsonSafely } from '@/lib/ops';
import { CalendarClock, GripVertical, Plus, RefreshCw } from 'lucide-react';

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
  customer_phone?: string | null;
};

function contextForLead(lead: Lead) {
  return parseJsonSafely<Record<string, unknown>>(lead.lead_context_json || '') || {};
}

function stageTone(status: string): 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'violet' {
  if (status === 'won') return 'success';
  if (status === 'lost' || status === 'nurture') return 'neutral';
  if (status === 'follow_up_needed') return 'danger';
  if (['planning_call_scheduled', 'design_layout_discussion'].includes(status)) return 'violet';
  if (['estimate_needed', 'proposal_sent', 'site_details_needed'].includes(status)) return 'warning';
  return 'brand';
}

export function LeadPipelineBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/leads?limit=300', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to load pipeline');
      setLeads(json.leads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredLeads = useMemo(() => {
    const needle = search.toLowerCase().trim();
    if (!needle) return leads;
    return leads.filter((lead) => {
      const context = contextForLead(lead);
      return [lead.customer_name, lead.customer_phone, lead.issue, lead.location, context.leadType, context.intendedUse]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [leads, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const stage of awpPipelineStages) map.set(stage.value, []);
    for (const lead of filteredLeads) {
      const status = awpPipelineStages.some((stage) => stage.value === lead.status) ? lead.status : 'new_lead';
      map.get(status)?.push(lead);
    }
    return map;
  }, [filteredLeads]);

  const totals = useMemo(() => {
    const open = leads.filter((lead) => !['won', 'lost'].includes(lead.status));
    return {
      open: open.length,
      value: open.reduce((sum, lead) => sum + Number(lead.estimated_value_cents || 0), 0),
      followUps: leads.filter((lead) => lead.status === 'follow_up_needed').length,
      proposals: leads.filter((lead) => lead.status === 'proposal_sent').length,
    };
  }, [leads]);

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

  return (
    <div className="flex min-h-[760px] flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-4 shadow-[var(--ops-shadow-soft)]">
        <div className="grid w-full gap-3 md:grid-cols-4 xl:w-auto">
          <div className="rounded-[20px] bg-[var(--ops-surface-subtle)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Open Leads</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{loading ? '...' : totals.open}</p>
          </div>
          <div className="rounded-[20px] bg-[var(--ops-surface-subtle)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Open Value</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{loading ? '...' : formatCurrency(totals.value, { cents: true })}</p>
          </div>
          <div className="rounded-[20px] bg-[var(--ops-surface-subtle)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Proposals</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{loading ? '...' : totals.proposals}</p>
          </div>
          <div className="rounded-[20px] bg-[var(--ops-surface-subtle)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Follow-Up Needed</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{loading ? '...' : totals.followUps}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <SearchField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pipeline..."
            className="min-w-[min(360px,100%)]"
          />
          <OpsButton type="button" variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </OpsButton>
          <Link href="/leads" className={opsButtonClass('primary')}>
            <Plus className="h-4 w-4" />
            Add Lead
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
          {error}
        </div>
      ) : null}
      {saving ? <p className="text-sm text-[var(--ops-muted)]">Saving pipeline stage...</p> : null}

      {loading ? (
        <EmptyState title="Loading pipeline" description="Fetching cabin lead stages." />
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto">
          <div className="flex h-full min-h-[640px] gap-4">
            {awpPipelineStages.map((stage) => {
              const stageLeads = grouped.get(stage.value) || [];
              return (
                <section
                  key={stage.value}
                  className="flex w-[22rem] shrink-0 flex-col rounded-[28px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] shadow-[var(--ops-shadow-soft)]"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedLeadId) moveLead(draggedLeadId, stage.value);
                  }}
                >
                  <div className="border-b border-[var(--ops-border)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        <h2 className="text-sm font-semibold text-[var(--ops-text)]">{stage.label}</h2>
                      </div>
                      <span className="rounded-full bg-[var(--ops-surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--ops-muted)]">
                        {stageLeads.length}
                      </span>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                    {stageLeads.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-[var(--ops-border-strong)] bg-[var(--ops-surface-subtle)] px-4 py-8 text-center text-sm text-[var(--ops-muted)]">
                        Drop leads here
                      </div>
                    ) : (
                      stageLeads.map((lead) => {
                        const context = contextForLead(lead);
                        return (
                          <article
                            key={lead.id}
                            draggable
                            onDragStart={() => setDraggedLeadId(lead.id)}
                            className="rounded-[24px] border border-[var(--ops-border)] bg-[var(--ops-surface)] p-4 shadow-[var(--ops-shadow-soft)] transition hover:border-[var(--ops-border-strong)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <Link href={`/leads/${lead.id}`} className="font-semibold text-[var(--ops-text)] hover:text-[var(--ops-brand)]">
                                  {lead.customer_name || 'Cabin lead'}
                                </Link>
                                <p className="mt-1 text-xs text-[var(--ops-muted)]">{lead.customer_phone || sourceFromSlug(lead.source)}</p>
                              </div>
                              <GripVertical className="h-4 w-4 shrink-0 text-[var(--ops-muted)]" />
                            </div>

                            <p className="mt-3 text-sm font-medium text-[var(--ops-text)]">{lead.issue}</p>
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--ops-muted)]">
                              {String(context.aiSummary || context.notes || lead.location || 'No summary yet.')}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <StatusBadge tone={stageTone(lead.status)}>{pipelineLabel(lead.status)}</StatusBadge>
                              <StatusBadge tone="neutral">{String(context.leadType || 'Lead')}</StatusBadge>
                              {lead.ai_score ? <StatusBadge tone="success">Score {lead.ai_score}</StatusBadge> : null}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[var(--ops-muted)]">
                              <div>
                                <p className="font-semibold text-[var(--ops-text)]">{formatCurrency(lead.estimated_value_cents || 0, { cents: true })}</p>
                                <p>Est. value</p>
                              </div>
                              <div>
                                <p className="font-semibold text-[var(--ops-text)]">{formatDateLabel(lead.next_follow_up_at)}</p>
                                <p>Next follow-up</p>
                              </div>
                            </div>

                            <div className="mt-4 flex items-center gap-2 text-xs text-[var(--ops-muted)]">
                              <CalendarClock className="h-3.5 w-3.5" />
                              <span>{formatDateLabel(lead.created_at)} / {sourceFromSlug(lead.source)}</span>
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
  );
}
