'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AppPageHeader,
  ConsolePanel,
  DataTable,
  KpiStrip,
  StatCard,
  StatusBadge,
  opsButtonClass,
} from '@/components/ops/ui';
import { pipelineLabel, sourceFromSlug } from '@/lib/awp/config';
import { formatCurrency, formatDateLabel, parseJsonSafely } from '@/lib/ops';
import { ArrowLeft, Bot, CalendarClock, FileText, Mail, Users } from 'lucide-react';

type Row = Record<string, unknown>;

function contextForLead(lead: Row) {
  return parseJsonSafely<Record<string, unknown>>(String(lead.lead_context_json || '')) || {};
}

function money(cents: unknown) {
  return formatCurrency(Number(cents || 0), { cents: true });
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Row | null>(null);
  const [estimates, setEstimates] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Row[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leads/${id}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed to load lead');
        if (!cancelled) {
          setLead(j.lead as Row);
          setEstimates((j.estimates as Row[]) || []);
          setJobs((j.jobs as Row[]) || []);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)] p-6">
        <div className="text-sm text-[var(--ops-muted)]">Loading lead...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)] p-6">
        <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
          {err || 'Lead not found'}
        </div>
        <Link href="/leads" className="mt-4 text-sm font-semibold text-[var(--ops-brand)] hover:underline">
          Back to leads
        </Link>
      </div>
    );
  }

  const context = contextForLead(lead);
  const customerName = String(lead.customer_name || 'Cabin lead');

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
          <Link href="/leads" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ops-brand)] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Cabin Leads
          </Link>

          <AppPageHeader
            icon={Users}
            eyebrow="Cabin Lead Detail"
            title={customerName}
            description={String(lead.issue || 'Cabin project opportunity')}
            actions={
              <>
                <Link href="/leads" className={opsButtonClass('secondary')}>
                  Edit in Leads
                </Link>
                <Link href="/ai-assistant" className={opsButtonClass('primary')}>
                  <Bot className="h-4 w-4" />
                  AI Growth Assistant
                </Link>
              </>
            }
          >
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="brand">{pipelineLabel(String(lead.status || 'new_lead'))}</StatusBadge>
              <StatusBadge tone="neutral">{sourceFromSlug(String(lead.source || ''))}</StatusBadge>
              <StatusBadge tone="success">Score {String(lead.ai_score || '-')}</StatusBadge>
            </div>
          </AppPageHeader>

          <KpiStrip className="xl:grid-cols-4">
            <StatCard label="Estimated Value" value={money(lead.estimated_value_cents)} meta={String(context.estimatedBudget || 'Budget not set')} tone="brand" icon={FileText} />
            <StatCard label="Next Follow-Up" value={formatDateLabel(String(lead.next_follow_up_at || ''))} meta="Sales discipline" tone="warning" icon={CalendarClock} />
            <StatCard label="Last Contacted" value={formatDateLabel(String(lead.last_contacted_at || ''))} meta="Recent touchpoint" tone="neutral" icon={Mail} />
            <StatCard label="Interest Level" value={String(context.cabinInterestLevel || '-')} meta={String(context.intendedUse || 'Use not set')} tone="success" icon={Users} />
          </KpiStrip>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <ConsolePanel title="Qualification Details" description="Site readiness and buyer/project fit for the next sales conversation.">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Lead type', context.leadType],
                    ['Company', context.company],
                    ['Project location', lead.location],
                    ['Intended use', context.intendedUse],
                    ['Owns land?', context.ownsLand],
                    ['Has site access?', context.hasSiteAccess],
                    ['Utilities available?', context.utilitiesAvailable],
                    ['Timeline', context.timeline],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">{String(label)}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--ops-text)]">{String(value || '-')}</p>
                    </div>
                  ))}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Notes and AI Summary" description="Use this for call prep, follow-up drafting, and handoff context.">
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">AI Summary</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ops-text)]">
                      {String(context.aiSummary || lead.ai_qualification || 'No AI summary yet.')}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Internal Notes</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ops-text)]">
                      {String(context.notes || lead.description || 'No notes yet.')}
                    </p>
                  </div>
                </div>
              </ConsolePanel>

              <ConsolePanel title="Estimates" description="Estimates tied to this lead.">
                <DataTable
                  columns={[
                    { key: 'number', label: 'Estimate' },
                    { key: 'title', label: 'Title' },
                    { key: 'status', label: 'Status' },
                    { key: 'total', label: 'Total' },
                  ]}
                  minWidthClassName="min-w-[720px]"
                  className="border-0 shadow-none"
                >
                  {estimates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-[var(--ops-muted)]">
                        No estimates yet.
                      </td>
                    </tr>
                  ) : (
                    estimates.map((estimate) => (
                      <tr key={String(estimate.id)}>
                        <td className="px-5 py-4">
                          <Link href={`/estimates/${estimate.id}`} className="font-semibold text-[var(--ops-brand)] hover:underline">
                            {String(estimate.estimate_number)}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--ops-text)]">{String(estimate.title || '-')}</td>
                        <td className="px-5 py-4">
                          <StatusBadge tone="neutral">{String(estimate.status || '-')}</StatusBadge>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-[var(--ops-text)]">{money(estimate.total_amount_cents)}</td>
                      </tr>
                    ))
                  )}
                </DataTable>
              </ConsolePanel>
            </div>

            <div className="space-y-6 xl:sticky xl:top-6">
              <ConsolePanel title="Next Best Actions" description="Simple actions for the sales owner.">
                <div className="space-y-3">
                  {[
                    'Confirm land ownership, access path, utilities, and slab/foundation readiness.',
                    'Draft a helpful follow-up email using the lead summary prompt.',
                    'If qualified, schedule or prep the planning/design call.',
                  ].map((item) => (
                    <div key={item} className="rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm leading-6 text-[var(--ops-text)]">
                      {item}
                    </div>
                  ))}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Related Jobs" description="Operational records created from this lead.">
                {jobs.length === 0 ? (
                  <p className="rounded-[20px] border border-dashed border-[var(--ops-border-strong)] bg-[var(--ops-surface-subtle)] px-4 py-6 text-center text-sm text-[var(--ops-muted)]">
                    No jobs from this lead.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <Link key={String(job.id)} href={`/jobs/${job.id}`} className="block rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 hover:bg-[var(--ops-surface-subtle)]">
                        <p className="text-sm font-semibold text-[var(--ops-text)]">{String(job.type || 'Job')}</p>
                        <p className="mt-1 text-xs text-[var(--ops-muted)]">{String(job.status || '')}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </ConsolePanel>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
