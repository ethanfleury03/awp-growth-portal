'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AppPageHeader,
  ConsolePanel,
  DataTable,
  KpiStrip,
  OpsButton,
  StatCard,
  StatusBadge,
} from '@/components/ops/ui';
import { sourceFromSlug } from '@/lib/awp/config';
import { formatCurrency } from '@/lib/ops';
import { BarChart3, Clipboard, FileText, Megaphone, Search, Sparkles, Users } from 'lucide-react';

type Lead = {
  id: string;
  source: string;
  status: string;
  issue: string;
  created_at: string;
  estimated_value_cents?: number | null;
  customer_name?: string | null;
  lead_context_json?: string | null;
};

type GrowthRecord = {
  id: string;
  title: string;
  status: string;
  payload?: Record<string, unknown>;
};

function isThisMonth(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getMonthLabel() {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export default function ReportsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<GrowthRecord[]>([]);
  const [seoTasks, setSeoTasks] = useState<GrowthRecord[]>([]);
  const [assets, setAssets] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [leadsRes, campaignsRes, seoRes, assetsRes] = await Promise.all([
          fetch('/api/leads?limit=300', { cache: 'no-store' }),
          fetch('/api/growth-records?type=campaign', { cache: 'no-store' }),
          fetch('/api/growth-records?type=seo_task', { cache: 'no-store' }),
          fetch('/api/growth-records?type=asset', { cache: 'no-store' }),
        ]);
        const [leadsJson, campaignsJson, seoJson, assetsJson] = await Promise.all([
          leadsRes.json(),
          campaignsRes.json(),
          seoRes.json(),
          assetsRes.json(),
        ]);
        const firstError = leadsJson.error || campaignsJson.error || seoJson.error || assetsJson.error;
        if (firstError) throw new Error(firstError);
        if (!cancelled) {
          setLeads(leadsJson.leads || []);
          setCampaigns(campaignsJson.records || []);
          setSeoTasks(seoJson.records || []);
          setAssets(assetsJson.records || []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const report = useMemo(() => {
    const monthLeads = leads.filter((lead) => isThisMonth(lead.created_at));
    const won = leads.filter((lead) => lead.status === 'won');
    const proposals = leads.filter((lead) => lead.status === 'proposal_sent');
    const replies = campaigns.reduce((sum, campaign) => sum + Number(campaign.payload?.replies || 0), 0);
    const completedSeo = seoTasks.filter((task) => task.status === 'Complete');
    const activeCampaigns = campaigns.filter((campaign) => ['Active', 'Ready', 'Drafting'].includes(campaign.status));
    const createdAssets = assets.filter((asset) => ['Drafting', 'Needs Review', 'Approved', 'Published'].includes(asset.status));
    const sourceCounts = countBy(leads, (lead) => sourceFromSlug(lead.source));
    const typeCounts = countBy(leads, (lead) => {
      try {
        const payload = JSON.parse(String(lead.lead_context_json || '{}')) as Record<string, unknown>;
        return String(payload.leadType || 'Unknown');
      } catch {
        return 'Unknown';
      }
    });
    const pipelineValue = leads
      .filter((lead) => !['won', 'lost'].includes(lead.status))
      .reduce((sum, lead) => sum + Number(lead.estimated_value_cents || 0), 0);

    return {
      monthLeads,
      won,
      proposals,
      replies,
      completedSeo,
      activeCampaigns,
      createdAssets,
      sourceCounts,
      typeCounts,
      pipelineValue,
    };
  }, [assets, campaigns, leads, seoTasks]);

  const reportText = useMemo(() => {
    const lines = [
      `Monthly Growth Report - ${getMonthLabel()}`,
      '',
      '1. Executive Summary',
      `${report.monthLeads.length} new leads were captured this month. Open pipeline value is ${formatCurrency(report.pipelineValue, { cents: true })}. ${report.activeCampaigns.length} campaigns are active, ready, or drafting.`,
      '',
      '2. Lead Activity',
      `New leads this month: ${report.monthLeads.length}`,
      `Proposals sent: ${report.proposals.length}`,
      `Won projects: ${report.won.length}`,
      '',
      '3. Campaign Activity',
      `Campaigns active/ready/drafting: ${report.activeCampaigns.length}`,
      `Replies received: ${report.replies}`,
      '',
      '4. Website/SEO Progress',
      `Website/SEO tasks completed: ${report.completedSeo.length}`,
      '',
      '5. Sales Assets Created',
      `Assets in progress/approved/published: ${report.createdAssets.length}`,
      '',
      '6. Key Wins',
      report.won.length > 0 ? report.won.map((lead) => `- ${lead.customer_name || lead.issue}`).join('\n') : '- No won projects recorded yet.',
      '',
      '7. Bottlenecks',
      '- Confirm site details earlier for leads with unknown land/access/utilities.',
      '- Keep follow-up dates current so hot leads do not stall.',
      '',
      '8. Recommended Next Steps',
      '- Finish buyer guide conversion flow.',
      '- Prioritize high-intent website pages and case studies.',
      '- Use AI Growth Assistant to draft follow-ups for qualified and proposal-stage leads.',
    ];
    return lines.join('\n');
  }, [report]);

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-6">
          <AppPageHeader
            icon={BarChart3}
            eyebrow="Growth Reports"
            title="Monthly Growth Report"
            description="Owner-facing summary of leads, campaigns, website/SEO progress, assets, bottlenecks, and recommended next actions."
            actions={
              <OpsButton type="button" variant="primary" onClick={copyReport}>
                <Clipboard className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy Report'}
              </OpsButton>
            }
          />

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <KpiStrip className="xl:grid-cols-4">
            <StatCard label="Leads Generated" value={loading ? '...' : report.monthLeads.length} meta="This month" tone="brand" icon={Users} />
            <StatCard label="Campaign Replies" value={loading ? '...' : report.replies} meta="Outreach response" tone="success" icon={Megaphone} />
            <StatCard label="SEO Tasks Complete" value={loading ? '...' : report.completedSeo.length} meta="Website progress" tone="warning" icon={Search} />
            <StatCard label="Assets Created" value={loading ? '...' : report.createdAssets.length} meta="Drafting or approved" tone="neutral" icon={FileText} />
          </KpiStrip>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <ConsolePanel title="Report Narrative" description="Copy this text into an email, doc, or client update.">
                <pre className="whitespace-pre-wrap rounded-[24px] border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] p-5 text-sm leading-6 text-[var(--ops-text)]">
                  {reportText}
                </pre>
              </ConsolePanel>

              <ConsolePanel title="Lead Activity" description="Lead source and type breakdown for prioritizing marketing spend and outreach.">
                <div className="grid gap-6 lg:grid-cols-2">
                  <DataTable
                    columns={[
                      { key: 'source', label: 'Source' },
                      { key: 'count', label: 'Leads' },
                    ]}
                    minWidthClassName="min-w-[360px]"
                    className="border-0 shadow-none"
                  >
                    {report.sourceCounts.map(([source, count]) => (
                      <tr key={source}>
                        <td className="px-5 py-4 text-sm font-semibold text-[var(--ops-text)]">{source}</td>
                        <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{count}</td>
                      </tr>
                    ))}
                  </DataTable>
                  <DataTable
                    columns={[
                      { key: 'type', label: 'Lead Type' },
                      { key: 'count', label: 'Leads' },
                    ]}
                    minWidthClassName="min-w-[360px]"
                    className="border-0 shadow-none"
                  >
                    {report.typeCounts.map(([type, count]) => (
                      <tr key={type}>
                        <td className="px-5 py-4 text-sm font-semibold text-[var(--ops-text)]">{type}</td>
                        <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{count}</td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              </ConsolePanel>
            </div>

            <div className="space-y-6 xl:sticky xl:top-6">
              <ConsolePanel title="Campaign Activity" description="Current outbound and lead magnet work.">
                <div className="space-y-3">
                  {report.activeCampaigns.map((campaign) => (
                    <div key={campaign.id} className="rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--ops-text)]">{campaign.title}</p>
                        <StatusBadge tone={campaign.status === 'Active' ? 'success' : 'warning'}>{campaign.status}</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ops-muted)]">{String(campaign.payload?.nextAction || '')}</p>
                    </div>
                  ))}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Recommended Next Actions" description="Simple weekly operating rhythm.">
                <div className="space-y-3">
                  {[
                    'Follow up with every proposal-stage and follow-up-needed lead.',
                    'Finish high-priority SEO pages before expanding lower-intent content.',
                    'Convert verified project notes into case studies and social/email features.',
                    'Keep partner outreach lists warm with realtor, campground, resort, and contractor segments.',
                  ].map((item) => (
                    <div key={item} className="flex gap-3 rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ops-brand)]" />
                      <span className="text-sm leading-6 text-[var(--ops-text)]">{item}</span>
                    </div>
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
