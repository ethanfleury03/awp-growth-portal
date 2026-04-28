'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ExternalLink, Loader2, ShieldAlert, Wrench } from 'lucide-react';

type ConnectInfo = {
  companyId: string;
  stripeAccountId: string | null;
  status: 'pending' | 'onboarding' | 'restricted' | 'enabled' | 'rejected';
  onboardingCompletedAt: string | null;
};

const STATUS_META: Record<
  ConnectInfo['status'],
  { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger'; help: string }
> = {
  pending: {
    label: 'Not started',
    tone: 'neutral',
    help: 'Start onboarding to accept customer payments.',
  },
  onboarding: {
    label: 'Onboarding in progress',
    tone: 'warning',
    help: 'Finish onboarding with Stripe to activate payouts.',
  },
  restricted: {
    label: 'Action required',
    tone: 'warning',
    help: 'Stripe needs more information before you can accept payments.',
  },
  enabled: {
    label: 'Ready to accept payments',
    tone: 'success',
    help: 'Customer payments will deposit to your bank account.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'danger',
    help: 'Stripe rejected your account. Contact support.',
  },
};

export default function ConnectOnboardingPage() {
  const params = useSearchParams();
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/payments/connect', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setInfo(json.connect as ConnectInfo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // On return from Stripe, refresh status.
  useEffect(() => {
    if (params?.get('return') === '1' || params?.get('refresh') === '1') {
      fetch('/api/settings/payments/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      }).finally(() => load());
    }
  }, [params, load]);

  async function startOnboarding() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/payments/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'onboard' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start onboarding');
      setBusy(false);
    }
  }

  const status = info?.status ?? 'pending';
  const meta = STATUS_META[status];

  return (
    <div className="p-6 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Payments — Stripe Connect</h1>
        <p className="text-sm text-muted-foreground mt-1">
          WNY Automation Portal routes customer payments through your own Stripe account so
          funds deposit directly into your bank. Complete a one-time onboarding
          with Stripe.
        </p>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && info && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                {meta.tone === 'success' && <CheckCircle2 className="size-5 text-emerald-600" />}
                {meta.tone === 'warning' && <Wrench className="size-5 text-amber-600" />}
                {meta.tone === 'danger' && <ShieldAlert className="size-5 text-red-600" />}
                <h2 className="text-lg font-medium">{meta.label}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{meta.help}</p>
              {info.stripeAccountId && (
                <p className="mt-2 text-xs font-mono text-muted-foreground">
                  acct: {info.stripeAccountId}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={startOnboarding}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              {status === 'enabled'
                ? 'Update account info'
                : status === 'onboarding' || status === 'restricted'
                  ? 'Continue onboarding'
                  : 'Start onboarding'}
            </button>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm text-sm text-muted-foreground">
        <h3 className="text-base font-medium text-foreground mb-2">How it works</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Click <em>Start onboarding</em>. Stripe will ask for business + bank details.</li>
          <li>Return to WNY Automation Portal — we&apos;ll mark your account enabled automatically.</li>
          <li>Invoices and estimate deposits will route through Stripe Checkout to your account.</li>
          <li>Payouts, refunds, and disputes appear in your Stripe dashboard.</li>
        </ol>
      </section>
    </div>
  );
}
