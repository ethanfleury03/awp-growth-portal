'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Clock3, Plus, Sparkles } from 'lucide-react';
import {
  AppPageHeader,
  ConsolePanel,
  DataTable,
  KpiStrip,
  SearchField,
  SegmentedFilterBar,
  StatCard,
  StatusBadge,
  opsButtonClass,
} from '@/components/ops/ui';
import { formatCurrency, formatDateLabel, humanizeToken, isWithinDays } from '@/lib/ops';

const statusTabs = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'converted', label: 'Converted' },
] as const;

interface EstimateRow {
  id: string;
  estimate_number: string;
  title: string;
  customer_name_snapshot: string;
  total_amount_cents: number;
  status: string;
  expiration_date?: string | null;
}

function estimateTone(status: string) {
  if (status === 'approved' || status === 'converted') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  if (status === 'sent' || status === 'viewed') return 'warning' as const;
  return 'neutral' as const;
}

export default function EstimatesListPage() {
  const [status, setStatus] = useState<(typeof statusTabs)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (status !== 'all') params.set('status', status);
        if (debounced) params.set('search', debounced);
        const [listRes, statsRes] = await Promise.all([
          fetch(`/api/estimates?${params}`),
          fetch('/api/estimates/stats'),
        ]);
        const listJson = await listRes.json();
        const statsJson = await statsRes.json();
        if (!cancelled) {
          setRows((listJson.estimates as EstimateRow[]) || []);
          setTotal(Number(listJson.total) || 0);
          setStats(statsJson.stats || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, debounced]);

  const openPipelineCount = useMemo(
    () => rows.filter((row) => ['draft', 'sent', 'viewed'].includes(row.status)).length,
    [rows],
  );

  const expiringSoon = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.expiration_date &&
          ['draft', 'sent', 'viewed'].includes(row.status) &&
          isWithinDays(row.expiration_date, 5),
      ).length,
    [rows],
  );

  const followUpNeeded = useMemo(
    () => rows.filter((row) => ['sent', 'viewed'].includes(row.status)).length,
    [rows],
  );

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total estimates', value: String(stats.total ?? 0), meta: `${openPipelineCount} still in flight`, tone: 'brand' as const },
      { label: 'Pipeline value', value: formatCurrency(Number(stats.total_value_cents || 0), { cents: true }), meta: 'Open quote volume', tone: 'brand' as const },
      { label: 'Needs follow-up', value: String(followUpNeeded), meta: `${expiringSoon} expiring soon`, tone: 'warning' as const },
      { label: 'Approved', value: String(stats.approved ?? 0), meta: `${stats.sent ?? 0} sent this cycle`, tone: 'success' as const },
      {
        label: 'Approval rate',
        value: stats.approval_rate == null ? '—' : `${Math.round(Number(stats.approval_rate) * 100)}%`,
        meta: `${stats.rejected ?? 0} rejected`,
        tone: 'neutral' as const,
      },
    ];
  }, [expiringSoon, followUpNeeded, openPipelineCount, stats]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
          <AppPageHeader
            eyebrow="Pipeline / Estimates"
            icon={ClipboardList}
            title="Estimates pipeline"
            description="Track what has been drafted, sent, viewed, and approved with more explicit follow-up pressure built into the list."
            actions={
              <>
                <SearchField
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search number, title, customer…"
                  className="min-w-[min(360px,100%)]"
                />
                <Link href="/estimates/settings" className={opsButtonClass('secondary')}>
                  Defaults
                </Link>
                <Link href="/estimates/new" className={opsButtonClass('primary')}>
                  <Plus className="h-4 w-4" />
                  New estimate
                </Link>
              </>
            }
          />

          <KpiStrip className="xl:grid-cols-5">
            {statCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={loading ? '…' : card.value}
                meta={card.meta}
                tone={card.tone}
                icon={card.label === 'Needs follow-up' ? Clock3 : card.label === 'Approved' ? Sparkles : undefined}
              />
            ))}
          </KpiStrip>

          <ConsolePanel
            title="Estimate list"
            description="Status tabs stay sticky at the top, while row styling makes expiring and follow-up quotes impossible to miss."
            action={
              <SegmentedFilterBar
                value={status}
                onChange={(value) => setStatus(value as (typeof statusTabs)[number]['id'])}
                options={statusTabs.map((tab) => ({
                  value: tab.id,
                  label: tab.label,
                }))}
              />
            }
          >
            <DataTable
              columns={[
                { key: 'number', label: 'Number' },
                { key: 'title', label: 'Title' },
                { key: 'customer', label: 'Customer' },
                { key: 'total', label: 'Total', align: 'right' },
                { key: 'status', label: 'Status' },
                { key: 'expires', label: 'Expires' },
                { key: 'actions', label: 'Open', align: 'right' },
              ]}
              footer={`Showing ${rows.length} of ${total} estimates`}
              minWidthClassName="min-w-[980px]"
              className="border-0 shadow-none"
            >
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-sm text-[var(--ops-muted)]">
                    Loading estimates…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-sm text-[var(--ops-muted)]">
                    No estimates match this filter yet.
                  </td>
                </tr>
              ) : (
                rows.map((estimate) => {
                  const expiring = Boolean(
                    estimate.expiration_date &&
                      ['draft', 'sent', 'viewed'].includes(estimate.status) &&
                      isWithinDays(estimate.expiration_date, 5),
                  );
                  return (
                    <tr
                      key={estimate.id}
                      className={
                        expiring
                          ? 'bg-[rgba(203,137,28,0.06)] transition-colors hover:bg-[rgba(203,137,28,0.12)]'
                          : 'transition-colors hover:bg-[var(--ops-surface-subtle)]'
                      }
                    >
                      <td className="px-5 py-4 text-xs font-mono text-[var(--ops-muted-strong)]">
                        {estimate.estimate_number}
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--ops-text)]">{estimate.title}</p>
                          {expiring ? <p className="mt-1 text-xs text-[var(--ops-warning-ink)]">Follow-up soon: expiration window is tightening.</p> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--ops-text)]">{estimate.customer_name_snapshot}</td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-[var(--ops-text)]">
                        {formatCurrency(estimate.total_amount_cents, { cents: true })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone={estimateTone(estimate.status)}>{humanizeToken(estimate.status)}</StatusBadge>
                          {['sent', 'viewed'].includes(estimate.status) ? <StatusBadge tone="warning">Follow-up</StatusBadge> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">
                        {estimate.expiration_date ? formatDateLabel(estimate.expiration_date) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/estimates/${estimate.id}`} className={opsButtonClass('ghost', 'sm')}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </DataTable>
          </ConsolePanel>
        </div>
      </main>
    </div>
  );
}
