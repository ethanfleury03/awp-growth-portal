'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConsolePanel, OpsButton, StatusBadge } from '@/components/ops/ui';
import { formatAssistantCost } from '@/lib/ai/models';
import { Activity, Coins, RefreshCw, Zap } from 'lucide-react';

type UsageSummary = {
  messages: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costLabel: string;
};

type ModelUsage = UsageSummary & {
  modelId: string;
  name: string;
  costTier: 'cheap' | 'expensive';
};

type UsageResponse = {
  totals: UsageSummary;
  month: UsageSummary;
  byModel: ModelUsage[];
  trackedMessages: number;
};

function formatTokens(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value || 0);
}

export function AiUsageCostPanel() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/ai-assistant/usage', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to load AI usage');
      setUsage(json.usage || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI usage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ConsolePanel
      title="AI API Cost Tracker"
      description="Estimated OpenRouter spend from saved assistant token usage."
      action={
        <OpsButton type="button" variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </OpsButton>
      }
    >
      {error ? (
        <div className="rounded-2xl border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">This month</p>
            <Coins className="h-4 w-4 text-[var(--ops-brand)]" />
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--ops-text)]">
            {usage?.month.costLabel || formatAssistantCost(0)}
          </p>
          <p className="mt-1 text-xs text-[var(--ops-muted)]">
            {formatTokens(usage?.month.totalTokens || 0)} tokens / {usage?.month.messages || 0} responses
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">All time</p>
            <Activity className="h-4 w-4 text-[var(--ops-brand)]" />
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--ops-text)]">
            {usage?.totals.costLabel || formatAssistantCost(0)}
          </p>
          <p className="mt-1 text-xs text-[var(--ops-muted)]">
            {formatTokens(usage?.totals.totalTokens || 0)} tokens / {usage?.totals.messages || 0} responses
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? <p className="text-sm text-[var(--ops-muted)]">Loading usage...</p> : null}
        {!loading && !usage?.byModel.length ? (
          <p className="text-sm text-[var(--ops-muted)]">No tracked AI usage yet.</p>
        ) : null}
        {usage?.byModel.map((model) => (
          <div key={model.modelId} className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{model.name}</p>
                <p className="mt-1 truncate text-xs text-[var(--ops-muted)]">{model.modelId}</p>
              </div>
              <StatusBadge tone={model.costTier === 'cheap' ? 'success' : 'danger'}>
                {model.costTier === 'cheap' ? 'Cheap' : 'Expensive'}
              </StatusBadge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ops-muted)]">
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ops-border)] px-2 py-1">
                <Zap className="h-3 w-3" />
                {formatTokens(model.totalTokens)} tokens
              </span>
              <span className="rounded-full border border-[var(--ops-border)] px-2 py-1">{model.messages} responses</span>
              <span className="rounded-full border border-[var(--ops-border)] px-2 py-1 font-semibold text-[var(--ops-text)]">{model.costLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </ConsolePanel>
  );
}
