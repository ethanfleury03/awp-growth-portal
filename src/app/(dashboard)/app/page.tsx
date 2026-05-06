'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AppPageHeader,
  ConsolePanel,
  DataTable,
  KpiStrip,
  StatCard,
  StatusBadge,
  opsButtonClass,
} from '@/components/ops/ui';
import { awpBusinessProfile, pipelineLabel, sourceFromSlug, sourceToSlug } from '@/lib/awp/config';
import { formatCurrency, formatDateLabel, parseJsonSafely } from '@/lib/ops';
import { BarChart3, CalendarClock, FileText, Mail, Megaphone, Sparkles, TrendingUp, Users } from 'lucide-react';

type Lead = {
  id: string;
  source: string;
  status: string;
  issue: string;
  location?: string;
  ai_score?: number;
  created_at: string;
  next_follow_up_at?: string | null;
  estimated_value_cents?: number | null;
  lead_context_json?: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
};

type GrowthRecord = {
  id: string;
  title: string;
  status: string;
  payload?: Record<string, unknown>;
  is_demo?: boolean;
};

type Bucket = {
  id: string;
  title: string;
  color?: string | null;
  position: number;
};

function getContext(lead: Lead) {
  return parseJsonSafely<Record<string, unknown>>(lead.lead_context_json || '') || {};
}

function numberFromPayload(record: GrowthRecord, key: string) {
  return Number(record.payload?.[key] || 0);
}

function isThisMonth(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function isDue(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return date <= end;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<GrowthRecord[]>([]);
  const [seoTasks, setSeoTasks] = useState<GrowthRecord[]>([]);
  const [assets, setAssets] = useState<GrowthRecord[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [leadsRes, bucketsRes, campaignsRes, seoRes, assetsRes] = await Promise.all([
          fetch('/api/leads?limit=200', { cache: 'no-store' }),
          fetch('/api/buckets', { cache: 'no-store' }),
          fetch('/api/growth-records?type=campaign', { cache: 'no-store' }),
          fetch('/api/growth-records?type=seo_task', { cache: 'no-store' }),
          fetch('/api/growth-records?type=asset', { cache: 'no-store' }),
        ]);
        const [leadsJson, bucketsJson, campaignsJson, seoJson, assetsJson] = await Promise.all([
          leadsRes.json(),
          bucketsRes.json(),
          campaignsRes.json(),
          seoRes.json(),
          assetsRes.json(),
        ]);

        const firstError = leadsJson.error || bucketsJson.error || campaignsJson.error || seoJson.error || assetsJson.error;
        if (firstError) throw new Error(firstError);

        if (!cancelled) {
          setLeads(leadsJson.leads || []);
          setBuckets(bucketsJson.buckets || []);
          setCampaigns(campaignsJson.records || []);
          setSeoTasks(seoJson.records || []);
          setAssets(assetsJson.records || []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const newThisMonth = leads.filter((lead) => isThisMonth(lead.created_at)).length;
    const planningCalls = leads.filter((lead) => lead.status === 'planning_call_scheduled').length;
    const proposals = leads.filter((lead) => lead.status === 'proposal_sent').length;
    const won = leads.filter((lead) => lead.status === 'won').length;
    const followUpsDue = leads.filter((lead) => isDue(lead.next_follow_up_at)).length;
    const outreachReplies = campaigns.reduce((sum, campaign) => sum + numberFromPayload(campaign, 'replies'), 0);
    const pipelineValue = leads
      .filter((lead) => !['lost', 'won'].includes(lead.status))
      .reduce((sum, lead) => sum + Number(lead.estimated_value_cents || 0), 0);

    return {
      totalLeads: leads.length,
      newThisMonth,
      planningCalls,
      proposals,
      won,
      outreachReplies,
      followUpsDue,
      pipelineValue,
    };
  }, [campaigns, leads]);

  const pipelineCounts = useMemo(
    () =>
      [...buckets].sort((a, b) => a.position - b.position).map((bucket) => ({
        id: bucket.id,
        value: sourceToSlug(bucket.title),
        label: bucket.title,
        color: bucket.color || '#2f6f53',
        count: leads.filter((lead) => lead.status === sourceToSlug(bucket.title)).length,
      })),
    [buckets, leads],
  );

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const label = sourceFromSlug(lead.source);
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [leads]);

  const followUpsDue = useMemo(
    () =>
      leads
        .filter((lead) => isDue(lead.next_follow_up_at))
        .sort((a, b) => String(a.next_follow_up_at || '').localeCompare(String(b.next_follow_up_at || '')))
        .slice(0, 6),
    [leads],
  );

  const activeCampaigns = campaigns.filter((campaign) => ['Active', 'Ready', 'Drafting'].includes(campaign.status)).slice(0, 4);
  const activeSeoTasks = seoTasks
    .filter((task) => ['High', 'Medium'].includes(String(task.payload?.priority || '')) || task.status !== 'Complete')
    .slice(0, 6);
  const assetsInProgress = assets.filter((asset) => ['Idea', 'Drafting', 'Needs Review'].includes(asset.status)).slice(0, 5);

  const aiSuggestions = [
    'Draft follow-up for all leads in Follow-Up Needed before the next business day.',
    'Use the buyer guide as the primary conversion offer on high-intent website pages.',
    'Prioritize site-prep questions before estimating projects where land/access details are unknown.',
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
          <AppPageHeader
            icon={TrendingUp}
            eyebrow="Growth Overview"
            title="WNY Automation Portal"
            description={`${awpBusinessProfile.shortName} dashboard for cabin leads, partner outreach, sales assets, website growth, and monthly follow-up discipline.`}
            actions={
              <>
                <Link href="/crm" className={opsButtonClass('primary')}>
                  <Users className="h-4 w-4" />
                  Cabin CRM
                </Link>
              </>
            }
          />

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <KpiStrip className="xl:grid-cols-4 2xl:grid-cols-8">
            <StatCard label="Total Leads" value={loading ? '...' : stats.totalLeads} meta="Cabin buyer and partner leads" tone="brand" icon={Users} />
            <StatCard label="New Leads This Month" value={loading ? '...' : stats.newThisMonth} meta="Fresh demand" tone="success" icon={Sparkles} />
            <StatCard label="Planning Calls Scheduled" value={loading ? '...' : stats.planningCalls} meta="Next sales step" tone="violet" icon={CalendarClock} />
            <StatCard label="Proposals Sent" value={loading ? '...' : stats.proposals} meta="Awaiting decision" tone="warning" icon={FileText} />
            <StatCard label="Won Projects" value={loading ? '...' : stats.won} meta="Closed cabin opportunities" tone="success" icon={TrendingUp} />
            <StatCard label="Outreach Replies" value={loading ? '...' : stats.outreachReplies} meta="Campaign responses" tone="sky" icon={Mail} />
            <StatCard label="Follow-Ups Due" value={loading ? '...' : stats.followUpsDue} meta="Needs attention" tone="danger" icon={CalendarClock} />
            <StatCard label="Estimated Pipeline Value" value={loading ? '...' : formatCurrency(stats.pipelineValue, { cents: true })} meta="Open opportunities" tone="neutral" icon={BarChart3} />
          </KpiStrip>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_420px]">
            <div className="space-y-6">
              <ConsolePanel title="Recent Leads" description="Newest cabin buyer and partner opportunities. Demo rows are clearly marked in their lead notes.">
                <DataTable
                  columns={[
                    { key: 'name', label: 'Lead' },
                    { key: 'interest', label: 'Interest' },
                    { key: 'source', label: 'Source' },
                    { key: 'stage', label: 'Stage' },
                    { key: 'score', label: 'Score' },
                    { key: 'received', label: 'Received' },
                  ]}
                  footer={`Showing ${Math.min(leads.length, 8)} of ${leads.length} leads`}
                  minWidthClassName="min-w-[980px]"
                  className="border-0 shadow-none"
                >
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--ops-muted)]">
                        Loading dashboard...
                      </td>
                    </tr>
                  ) : (
                    leads.slice(0, 8).map((lead) => {
                      const context = getContext(lead);
                      return (
                        <tr key={lead.id} className="transition-colors hover:bg-[var(--ops-surface-subtle)]">
                          <td className="px-5 py-4">
                            <Link href={`/crm/leads/${lead.id}`} className="text-sm font-semibold text-[var(--ops-text)] hover:text-[var(--ops-brand)]">
                              {lead.customer_name || 'Cabin lead'}
                            </Link>
                            <p className="mt-1 text-xs text-[var(--ops-muted)]">{lead.customer_phone || lead.customer_email || lead.location || 'No contact yet'}</p>
                          </td>
                          <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">
                            <p className="font-medium text-[var(--ops-text)]">{lead.issue}</p>
                            <p className="mt-1 text-xs">{String(context.intendedUse || context.leadType || 'Cabin project')}</p>
                          </td>
                          <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{sourceFromSlug(lead.source)}</td>
                          <td className="px-5 py-4">
                            <StatusBadge tone={lead.status === 'won' ? 'success' : lead.status === 'lost' ? 'neutral' : 'brand'}>
                              {pipelineLabel(lead.status)}
                            </StatusBadge>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-[var(--ops-text)]">{lead.ai_score || '-'}</td>
                          <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{formatDateLabel(lead.created_at)}</td>
                        </tr>
                      );
                    })
                  )}
                </DataTable>
              </ConsolePanel>

              <ConsolePanel title="Pipeline Overview" description="A compact view of the Cabin Lead Pipeline stages.">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {pipelineCounts.map((stage) => (
                    <Link key={stage.id} href="/crm" className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 transition-colors hover:bg-[var(--ops-surface-subtle)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                          <span className="text-sm font-semibold text-[var(--ops-text)]">{stage.label}</span>
                        </div>
                        <span className="text-lg font-semibold text-[var(--ops-text)]">{stage.count}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </ConsolePanel>

              <div className="grid gap-6 lg:grid-cols-2">
                <ConsolePanel title="Outreach Activity" description="Campaigns that are active, ready, or being drafted.">
                  <div className="space-y-3">
                    {activeCampaigns.map((campaign) => (
                      <Link key={campaign.id} href="/outreach?tab=campaigns" className="block rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 hover:bg-[var(--ops-surface-subtle)]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--ops-text)]">{campaign.title}</p>
                            <p className="mt-1 text-xs text-[var(--ops-muted)]">{String(campaign.payload?.audience || 'Audience')} / {String(campaign.payload?.nextAction || 'No next action')}</p>
                          </div>
                          <StatusBadge tone={campaign.status === 'Active' ? 'success' : 'warning'}>{campaign.status}</StatusBadge>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--ops-muted)]">
                          <span>{numberFromPayload(campaign, 'emailsSent')} sent</span>
                          <span>{numberFromPayload(campaign, 'replies')} replies</span>
                          <span>{numberFromPayload(campaign, 'leadsGenerated')} leads</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </ConsolePanel>

                <ConsolePanel title="Follow-Ups Due" description="Leads with a follow-up date due today or earlier.">
                  <div className="space-y-3">
                    {followUpsDue.length === 0 ? (
                      <p className="rounded-[22px] border border-dashed border-[var(--ops-border-strong)] bg-[var(--ops-surface-subtle)] px-4 py-6 text-center text-sm text-[var(--ops-muted)]">
                        No follow-ups due.
                      </p>
                    ) : (
                      followUpsDue.map((lead) => (
                        <Link key={lead.id} href={`/crm/leads/${lead.id}`} className="block rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 hover:bg-[var(--ops-surface-subtle)]">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[var(--ops-text)]">{lead.customer_name || lead.issue}</p>
                              <p className="mt-1 text-xs text-[var(--ops-muted)]">{lead.issue}</p>
                            </div>
                            <StatusBadge tone="danger">{formatDateLabel(lead.next_follow_up_at)}</StatusBadge>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </ConsolePanel>
              </div>
            </div>

            <div className="space-y-6 xl:sticky xl:top-6">
              <ConsolePanel title="Top Lead Sources" description="Where AWP opportunities are coming from.">
                <div className="space-y-3">
                  {sourceCounts.map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <span className="text-sm font-semibold text-[var(--ops-text)]">{source}</span>
                      <span className="text-sm text-[var(--ops-muted)]">{count} leads</span>
                    </div>
                  ))}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Marketing Work" description="Highest-signal website and sales asset work.">
                <div className="space-y-3">
                  {activeSeoTasks.map((task) => (
                    <Link key={task.id} href="/marketing?tab=seo" className="block rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 hover:bg-[var(--ops-surface-subtle)]">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--ops-text)]">{task.title}</p>
                        <StatusBadge tone={String(task.payload?.priority) === 'High' ? 'danger' : 'warning'}>{String(task.payload?.priority || task.status)}</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ops-muted)]">{String(task.payload?.targetKeyword || task.payload?.taskType || '')}</p>
                    </Link>
                  ))}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Assets in Progress" description="Sales and marketing assets that need finishing.">
                <div className="space-y-3">
                  {assetsInProgress.map((asset) => (
                    <Link key={asset.id} href="/marketing?tab=assets" className="block rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 hover:bg-[var(--ops-surface-subtle)]">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--ops-text)]">{asset.title}</p>
                        <StatusBadge tone={asset.status === 'Needs Review' ? 'warning' : 'brand'}>{asset.status}</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ops-muted)]">{String(asset.payload?.assetType || 'Asset')}</p>
                    </Link>
                  ))}
                </div>
              </ConsolePanel>

              <ConsolePanel title="AI Suggestions" description="Suggested next moves for the AI Growth Assistant.">
                <div className="space-y-3">
                  {aiSuggestions.map((suggestion) => (
                    <Link key={suggestion} href="/ai-assistant" className="flex gap-3 rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 hover:bg-[var(--ops-surface-subtle)]">
                      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ops-brand)]" />
                      <span className="text-sm leading-6 text-[var(--ops-text)]">{suggestion}</span>
                    </Link>
                  ))}
                </div>
              </ConsolePanel>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
