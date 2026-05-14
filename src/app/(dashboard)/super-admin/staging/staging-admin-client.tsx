'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';

type StagingSummary = {
  configured: boolean;
  stagingUrl: string | null;
  healthUrl: string | null;
  health: {
    ok: boolean;
    status: 'unconfigured' | 'healthy' | 'degraded' | 'timeout' | 'unreachable';
    checkedAt: string;
    httpStatus?: number;
    db?: string | null;
    version?: string | null;
    elapsedMs?: number | null;
    error?: string;
    checks?: Record<string, unknown> | null;
  };
  environment: {
    appEnv: string;
    vercelEnv: string | null;
    branch: string | null;
    commit: string | null;
    deploymentUrl: string | null;
    onVercel: boolean;
  };
};

const statusTone: Record<StagingSummary['health']['status'], string> = {
  healthy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  degraded: 'border-amber-200 bg-amber-50 text-amber-700',
  timeout: 'border-amber-200 bg-amber-50 text-amber-700',
  unreachable: 'border-red-200 bg-red-50 text-red-700',
  unconfigured: 'border-slate-200 bg-slate-100 text-slate-700',
};

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-3 truncate text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function StagingAdminClient() {
  const [summary, setSummary] = useState<StagingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/staging', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load staging status.');
      setSummary(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staging status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const statusLabel = useMemo(() => {
    if (!summary) return 'Loading';
    return summary.health.status.replace(/^\w/, (s) => s.toUpperCase());
  }, [summary]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6">
      <header className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur lg:-mx-6 lg:-mt-6 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/super-admin" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" /> Back to super admin
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Staging</h1>
            <p className="text-sm text-slate-600">Dedicated staging deployment for WNY super admins.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            {summary?.stagingUrl ? (
              <a
                href={summary.stagingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              >
                <ExternalLink className="h-4 w-4" /> Open staging
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Server} label="Environment" value={summary?.environment.appEnv || 'Loading'} />
        <Stat icon={Activity} label="Health" value={statusLabel} />
        <Stat icon={ShieldCheck} label="Access" value="Super admin only" />
        <Stat icon={CheckCircle2} label="Database" value={summary?.health.db || 'Pending'} />
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Deployment status</h2>
            <p className="mt-1 text-sm text-slate-500">Current staging URL, health check, and build metadata.</p>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${summary ? statusTone[summary.health.status] : statusTone.unconfigured}`}>
            {summary?.health.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {statusLabel}
          </span>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <InfoRow label="Staging URL" value={summary?.stagingUrl || 'Not configured'} />
            <InfoRow label="Health URL" value={summary?.healthUrl || 'Not configured'} />
            <InfoRow label="Last check" value={summary?.health.checkedAt ? new Date(summary.health.checkedAt).toLocaleString() : 'Pending'} />
            {summary?.health.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {summary.health.error}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-950">Build metadata</h3>
            <div className="mt-3 space-y-2">
              <InfoRow compact label="Vercel env" value={summary?.environment.vercelEnv || 'local'} />
              <InfoRow compact label="Branch" value={summary?.environment.branch || 'Unknown'} />
              <InfoRow compact label="Commit" value={summary?.environment.commit || 'Unknown'} />
              <InfoRow compact label="HTTP" value={summary?.health.httpStatus ? String(summary.health.httpStatus) : 'Pending'} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? 'flex items-center justify-between gap-3 text-sm' : 'rounded-lg border border-slate-200 px-3 py-2'}>
      <p className={compact ? 'text-slate-500' : 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'}>{label}</p>
      <p className={compact ? 'truncate font-medium text-slate-900' : 'mt-1 break-all text-sm font-medium text-slate-900'}>{value}</p>
    </div>
  );
}
