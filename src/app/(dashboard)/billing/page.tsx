'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppPageHeader,
  ConsolePanel,
  KpiStrip,
  OpsButton,
  StatCard,
  StatusBadge,
} from '@/components/ops/ui';
import {
  AlertCircle,
  Bot,
  CalendarDays,
  Coins,
  CreditCard,
  ExternalLink,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react';

type ModelUsage = {
  modelId: string;
  name: string;
  costTier: 'cheap' | 'expensive';
  messages: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  providerCostUsd: number;
  providerCostLabel: string;
  overageAmountCents: number;
  overageLabel: string;
};

type BillingSummary = {
  plan: {
    key: string;
    name: string;
    amountCents: number;
    amountLabel: string;
    interval: string;
    overageMultiplier: number;
  };
  stripe: {
    configured: boolean;
    priceConfigured: boolean;
    priceId: string | null;
    customerPortalReady: boolean;
  };
  subscription: {
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    updatedAt: string | null;
  } | null;
  period: { start: string; end: string };
  aiUsage: {
    messages: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    providerCostUsd: number;
    providerCostLabel: string;
    overageAmountCents: number;
    overageLabel: string;
    byModel: ModelUsage[];
  };
  recentMessages: {
    id: string;
    model: string;
    createdAt: string | null;
    inputTokens: number;
    outputTokens: number;
    providerCostUsd: number;
    contentPreview: string;
  }[];
  usagePeriods: {
    id: string;
    periodStart: string;
    periodEnd: string;
    providerCostUsd: number;
    overageAmountCents: number;
    overageLabel: string;
    status: string;
    stripeInvoiceId: string | null;
    stripeInvoiceItemId: string | null;
  }[];
  invoices: {
    id: string;
    number: string | null;
    status: string;
    currency: string;
    amountDueCents: number;
    amountPaidCents: number;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
    createdAt: string | null;
    lines: { description: string; amountCents: number }[];
  }[];
};

function formatTokens(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value || 0);
}

function formatMoney(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function subscriptionTone(status?: string | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active' || status === 'trialing') return 'success';
  if (status === 'past_due' || status === 'incomplete') return 'warning';
  if (status === 'canceled' || status === 'unpaid') return 'danger';
  return 'neutral';
}

function statusLabel(value?: string | null) {
  if (!value) return 'Not started';
  return value.replace(/_/g, ' ');
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'checkout' | 'portal' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/billing/summary', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to load billing');
      setBilling(json.billing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const nextInvoiceTotal = useMemo(() => {
    if (!billing) return 0;
    return billing.plan.amountCents + billing.aiUsage.overageAmountCents;
  }, [billing]);

  const maxModelCharge = useMemo(
    () => Math.max(1, ...(billing?.aiUsage.byModel || []).map((model) => model.overageAmountCents)),
    [billing],
  );

  async function redirectFrom(endpoint: '/api/billing/checkout' | '/api/billing/portal', action: 'checkout' | 'portal') {
    try {
      setBusyAction(action);
      setError('');
      const response = await fetch(endpoint, { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Stripe action failed');
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stripe action failed');
      setBusyAction(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
          <AppPageHeader
            icon={CreditCard}
            eyebrow="Account / Billing"
            title="Billing"
            description="Subscription payment status, Stripe invoices, and AI assistant usage for this workspace."
            actions={
              <>
                <OpsButton type="button" variant="secondary" onClick={load} disabled={loading}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </OpsButton>
                {billing?.subscription ? (
                  <OpsButton
                    type="button"
                    variant="primary"
                    onClick={() => redirectFrom('/api/billing/portal', 'portal')}
                    disabled={busyAction !== null}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {busyAction === 'portal' ? 'Opening...' : 'Manage billing'}
                  </OpsButton>
                ) : (
                  <OpsButton
                    type="button"
                    variant="primary"
                    onClick={() => redirectFrom('/api/billing/checkout', 'checkout')}
                    disabled={busyAction !== null || !billing?.stripe.priceConfigured}
                  >
                    <CreditCard className="h-4 w-4" />
                    {busyAction === 'checkout' ? 'Starting...' : 'Start subscription'}
                  </OpsButton>
                )}
              </>
            }
          />

          {error ? (
            <div className="rounded-xl border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          {!loading && billing && !billing.stripe.priceConfigured ? (
            <div className="rounded-xl border border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] px-4 py-3 text-sm text-[var(--ops-warning-ink)]">
              Set STRIPE_PRICE_AWP_CRM_MONTHLY to enable Stripe Checkout for this Billing tab.
            </div>
          ) : null}

          <KpiStrip>
            <StatCard
              label="Subscription"
              value={billing?.plan.amountLabel || '$100.00'}
              meta={billing?.subscription ? statusLabel(billing.subscription.status) : 'Not started'}
              tone="brand"
              icon={CreditCard}
              badge={
                <StatusBadge tone={subscriptionTone(billing?.subscription?.status)}>
                  {billing?.subscription ? statusLabel(billing.subscription.status) : 'Setup'}
                </StatusBadge>
              }
            />
            <StatCard
              label="AI overage"
              value={billing?.aiUsage.overageLabel || '$0.00'}
              meta={`${billing?.plan.overageMultiplier || 2}x provider cost`}
              tone="warning"
              icon={Coins}
            />
            <StatCard
              label="Tokens this period"
              value={formatTokens(billing?.aiUsage.totalTokens || 0)}
              meta={`${billing?.aiUsage.messages || 0} assistant responses`}
              tone="success"
              icon={Bot}
            />
            <StatCard
              label="Projected invoice"
              value={formatMoney(nextInvoiceTotal)}
              meta={`Renews ${formatDate(billing?.subscription?.currentPeriodEnd || billing?.period.end)}`}
              tone="neutral"
              icon={ReceiptText}
            />
          </KpiStrip>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <ConsolePanel
                title="Subscription"
                description="Monthly CRM access and Stripe billing state."
                icon={ShieldCheck}
                action={
                  <StatusBadge tone={subscriptionTone(billing?.subscription?.status)}>
                    {billing?.subscription ? statusLabel(billing.subscription.status) : 'Not started'}
                  </StatusBadge>
                }
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Plan</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--ops-text)]">{billing?.plan.name || 'WNY Automation Portal CRM'}</p>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">{billing?.plan.amountLabel || '$100.00'} / month</p>
                  </div>
                  <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Current period</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--ops-text)]">{formatDate(billing?.period.start)}</p>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">to {formatDate(billing?.period.end)}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Stripe customer</p>
                    <p className="mt-2 truncate font-mono text-sm font-semibold text-[var(--ops-text)]">
                      {billing?.subscription?.stripeCustomerId || 'Pending checkout'}
                    </p>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">{billing?.stripe.configured ? 'Stripe connected' : 'Stripe not configured'}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <OpsButton
                    type="button"
                    variant={billing?.subscription ? 'secondary' : 'primary'}
                    onClick={() => redirectFrom('/api/billing/checkout', 'checkout')}
                    disabled={busyAction !== null || !billing?.stripe.priceConfigured}
                  >
                    <CreditCard className="h-4 w-4" />
                    {billing?.subscription ? 'Review subscription' : 'Start subscription'}
                  </OpsButton>
                  <OpsButton
                    type="button"
                    variant="secondary"
                    onClick={() => redirectFrom('/api/billing/portal', 'portal')}
                    disabled={busyAction !== null || !billing?.stripe.customerPortalReady}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Update payment method
                  </OpsButton>
                </div>
              </ConsolePanel>

              <ConsolePanel
                title="AI assistant usage"
                description="Provider cost is tracked from saved token usage and billed at the configured overage multiplier."
                icon={Zap}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Provider cost</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{billing?.aiUsage.providerCostLabel || '$0.00'}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Billed overage</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{billing?.aiUsage.overageLabel || '$0.00'}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Responses</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{billing?.aiUsage.messages || 0}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {billing?.aiUsage.byModel.length ? billing.aiUsage.byModel.map((model) => (
                    <div key={model.modelId} className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{model.name}</p>
                            <StatusBadge tone={model.costTier === 'cheap' ? 'success' : 'danger'}>
                              {model.costTier === 'cheap' ? 'Cheap' : 'Expensive'}
                            </StatusBadge>
                          </div>
                          <p className="mt-1 truncate font-mono text-xs text-[var(--ops-muted)]">{model.modelId}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-semibold text-[var(--ops-text)]">{model.overageLabel}</p>
                          <p className="mt-1 text-xs text-[var(--ops-muted)]">{model.providerCostLabel} provider</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--ops-surface-subtle)]">
                        <div
                          className={model.costTier === 'cheap' ? 'h-full rounded-full bg-[var(--ops-success)]' : 'h-full rounded-full bg-[var(--ops-warning)]'}
                          style={{ width: `${Math.max(4, Math.round((model.overageAmountCents / maxModelCharge) * 100))}%` }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ops-muted)]">
                        <span className="rounded-full border border-[var(--ops-border)] px-2 py-1">{formatTokens(model.totalTokens)} tokens</span>
                        <span className="rounded-full border border-[var(--ops-border)] px-2 py-1">{model.messages} responses</span>
                        <span className="rounded-full border border-[var(--ops-border)] px-2 py-1">{formatTokens(model.inputTokens)} input</span>
                        <span className="rounded-full border border-[var(--ops-border)] px-2 py-1">{formatTokens(model.outputTokens)} output</span>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-6 text-sm text-[var(--ops-muted)]">
                      No AI usage in this billing period.
                    </div>
                  )}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Recent assistant activity" description="Latest tracked responses in the active billing period." icon={Bot}>
                <div className="overflow-x-auto rounded-xl border border-[var(--ops-border)]">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[var(--ops-surface-subtle)] text-xs uppercase tracking-[0.12em] text-[var(--ops-muted)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Model</th>
                        <th className="px-4 py-3 font-semibold">Tokens</th>
                        <th className="px-4 py-3 font-semibold">Provider</th>
                        <th className="px-4 py-3 font-semibold">Preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ops-border)] bg-[var(--ops-surface-strong)]">
                      {billing?.recentMessages.length ? billing.recentMessages.map((message) => (
                        <tr key={message.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-[var(--ops-text)]">{formatDate(message.createdAt)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--ops-muted)]">{message.model}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-[var(--ops-text)]">
                            {formatTokens(message.inputTokens + message.outputTokens)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[var(--ops-text)]">
                            {message.providerCostUsd > 0 ? `$${message.providerCostUsd.toFixed(4)}` : '$0.00'}
                          </td>
                          <td className="max-w-[280px] truncate px-4 py-3 text-[var(--ops-muted)]">{message.contentPreview || 'No preview'}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-[var(--ops-muted)]">No assistant activity yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </ConsolePanel>
            </div>

            <div className="space-y-6 xl:sticky xl:top-6">
              <ConsolePanel title="Next invoice" description="Base subscription plus current AI overage." icon={ReceiptText}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <span className="text-sm text-[var(--ops-muted)]">CRM subscription</span>
                    <span className="text-sm font-semibold text-[var(--ops-text)]">{billing?.plan.amountLabel || '$100.00'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <span className="text-sm text-[var(--ops-muted)]">AI overage</span>
                    <span className="text-sm font-semibold text-[var(--ops-text)]">{billing?.aiUsage.overageLabel || '$0.00'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ops-border-strong)] bg-[var(--ops-brand-soft)] px-4 py-4">
                    <span className="text-sm font-semibold text-[var(--ops-brand-ink)]">Projected total</span>
                    <span className="text-lg font-semibold text-[var(--ops-brand-ink)]">{formatMoney(nextInvoiceTotal)}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] px-4 py-3 text-sm text-[var(--ops-warning-ink)]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>AI usage warnings are informational. The assistant remains available when usage rises.</p>
                </div>
              </ConsolePanel>

              <ConsolePanel title="AI overage periods" description="Monthly usage records created for Stripe invoice items." icon={CalendarDays}>
                <div className="space-y-3">
                  {billing?.usagePeriods.length ? billing.usagePeriods.map((period) => (
                    <div key={period.id} className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--ops-text)]">{formatDate(period.periodStart)}</p>
                          <p className="mt-1 text-xs text-[var(--ops-muted)]">through {formatDate(period.periodEnd)}</p>
                        </div>
                        <StatusBadge tone={period.status === 'paid' ? 'success' : period.status === 'payment_failed' ? 'danger' : 'neutral'}>
                          {statusLabel(period.status)}
                        </StatusBadge>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                        <span className="text-[var(--ops-muted)]">Overage</span>
                        <span className="font-semibold text-[var(--ops-text)]">{period.overageLabel}</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-[var(--ops-muted)]">No billed AI overage periods yet.</p>
                  )}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Stripe invoices" description="Recent invoices from the Stripe customer record." icon={ReceiptText}>
                <div className="space-y-3">
                  {billing?.invoices.length ? billing.invoices.map((invoice) => (
                    <div key={invoice.id} className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{invoice.number || invoice.id}</p>
                          <p className="mt-1 text-xs text-[var(--ops-muted)]">{formatDate(invoice.createdAt)}</p>
                        </div>
                        <StatusBadge tone={invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : 'neutral'}>
                          {statusLabel(invoice.status)}
                        </StatusBadge>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                        <span className="text-[var(--ops-muted)]">Amount paid</span>
                        <span className="font-semibold text-[var(--ops-text)]">{formatMoney(invoice.amountPaidCents, invoice.currency)}</span>
                      </div>
                      {invoice.hostedInvoiceUrl ? (
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ops-brand)] hover:underline"
                        >
                          Open invoice <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  )) : (
                    <p className="text-sm text-[var(--ops-muted)]">No Stripe invoices are available yet.</p>
                  )}
                </div>
              </ConsolePanel>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
