'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { getSalesMailto } from '@/lib/marketing/cta';
import { PlanCheckoutButton } from './PlanCheckoutButton';
import { LeadModal } from './LeadModal';

type Cadence = 'monthly' | 'annual';

interface Tier {
  name: string;
  tagline: string;
  priceMonthly: number | 'custom';
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  note?: string;
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    tagline: 'For owner-operators and first-time hires.',
    priceMonthly: 149,
    features: [
      '1 branch',
      'Up to 2 techs',
      'AI receptionist (shared voice)',
      'Estimates + invoices + PDFs',
      'Stripe Connect payments',
      'Customer portal',
      'Email notifications',
      'Cmd-K search',
    ],
    cta: 'Start free trial',
    ctaHref: '/sign-up',
  },
  {
    name: 'Pro',
    tagline: 'For growing shops hitting dispatch pain.',
    priceMonthly: 349,
    features: [
      '3 branches',
      'Up to 10 techs',
      'AI receptionist (branded voice)',
      'Dispatch board + route suggestions',
      'Mobile tech app',
      'Bulk actions on invoices',
      'Reports dashboard',
      'Service contracts',
      'SMS notifications + STOP handling',
      'Signature capture on estimates',
    ],
    cta: 'Start free trial',
    ctaHref: '/sign-up',
    highlighted: true,
    note: 'Most popular',
  },
  {
    name: 'Scale',
    tagline: 'For multi-branch operators and franchises.',
    priceMonthly: 'custom',
    features: [
      'Unlimited branches + techs',
      'SSO (Clerk + SAML)',
      'Audit log export + SOC alignment',
      'Super-admin controls + feature flags',
      'Dedicated onboarding + training',
      'Priority support SLA',
      'Custom data export + API access',
    ],
    cta: 'Talk to sales',
    ctaHref: getSalesMailto(),
  },
];

const COMPARE = [
  { label: 'Branches', rows: ['1', '3', 'Unlimited'] },
  { label: 'Techs', rows: ['2', '10', 'Unlimited'] },
  { label: 'AI receptionist', rows: ['Shared voice', 'Branded voice', 'Multi-voice + routing'] },
  { label: 'Dispatch board', rows: [false, true, true] },
  { label: 'Mobile tech app', rows: [false, true, true] },
  { label: 'Reports dashboard', rows: [false, true, true] },
  { label: 'Service contracts', rows: [false, true, true] },
  { label: 'Signature capture', rows: [false, true, true] },
  { label: 'SMS notifications', rows: [false, true, true] },
  { label: 'SSO (SAML)', rows: [false, false, true] },
  { label: 'Audit log export', rows: [false, false, true] },
  { label: 'Dedicated onboarding', rows: [false, false, true] },
];

export function Pricing() {
  const [cadence, setCadence] = useState<Cadence>('monthly');

  return (
    <section id="pricing" className="py-24 bg-[var(--brand-cream)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="eyebrow">Pricing</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Simple, shop-friendly pricing.
          </h2>
          <p className="mt-4 text-lg text-[var(--brand-slate)]">
            Start free for 14 days. No credit card. Cancel anytime. Stripe fees passed through at cost — we
            don&apos;t mark up your payments.
          </p>

          <div className="mt-8 inline-flex items-center rounded-full border border-slate-200 bg-[var(--brand-cream-2)] p-1 shadow-[var(--brand-shadow-sm)]">
            <button
              type="button"
              onClick={() => setCadence('monthly')}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${
                cadence === 'monthly'
                  ? 'bg-white shadow-[var(--brand-shadow-sm)] text-[var(--brand-ink)]'
                  : 'text-[var(--brand-slate)]'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCadence('annual')}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all flex items-center gap-2 ${
                cadence === 'annual'
                  ? 'bg-white shadow-[var(--brand-shadow-sm)] text-[var(--brand-ink)]'
                  : 'text-[var(--brand-slate)]'
              }`}
            >
              Annual
              <span className="rounded bg-[var(--brand-blue-500)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                2 mo. free
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {TIERS.map((tier) => {
            const price =
              tier.priceMonthly === 'custom'
                ? 'Custom'
                : cadence === 'annual'
                  ? `$${Math.round(tier.priceMonthly * 10)}`
                  : `$${tier.priceMonthly}`;
            const subtitle =
              tier.priceMonthly === 'custom'
                ? 'Billed annually'
                : cadence === 'annual'
                  ? 'per year · 2 months free'
                  : 'per month';

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  tier.highlighted
                    ? 'bg-[linear-gradient(180deg,var(--brand-navy-800),var(--brand-navy-900))] text-white border border-white/8 shadow-[var(--brand-shadow-lg)] ring-1 ring-[var(--brand-blue-500)]/20'
                    : 'bg-white border border-slate-200'
                }`}
              >
                {tier.note && (
                  <span className="absolute -top-3 left-6 rounded-full bg-[var(--brand-blue-500)] px-3 py-1 text-[11px] font-bold text-white shadow-md">
                    {tier.note}
                  </span>
                )}
                <h3
                  className={`text-xl font-bold ${tier.highlighted ? 'text-white' : 'text-[var(--brand-ink)]'}`}
                >
                  {tier.name}
                </h3>
                <p className={`mt-1.5 text-sm ${tier.highlighted ? 'text-white/70' : 'text-[var(--brand-slate-muted)]'}`}>
                  {tier.tagline}
                </p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className={`text-4xl font-extrabold tracking-tight ${tier.highlighted ? 'text-white' : ''}`}>
                    {price}
                  </span>
                  <span className={`text-sm ${tier.highlighted ? 'text-white/60' : 'text-[var(--brand-slate-muted)]'}`}>
                    {subtitle}
                  </span>
                </div>

                <ul className="mt-6 space-y-2.5 flex-1">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-2.5 text-sm ${tier.highlighted ? 'text-white/85' : 'text-[var(--brand-ink)]'}`}
                    >
                        <Check
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                          tier.highlighted ? 'text-[#a9c4ff]' : 'text-[var(--brand-orange-600)]'
                        }`}
                        />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {tier.name === 'Starter' || tier.name === 'Pro' ? (
                  <PlanCheckoutButton
                    plan={tier.name.toLowerCase() as 'starter' | 'pro'}
                    billingCycle={cadence}
                    className={`mt-8 w-full text-center ${tier.highlighted ? 'btn-primary' : 'btn-ghost-dark'}`}
                  >
                    {tier.cta}
                  </PlanCheckoutButton>
                ) : tier.name === 'Scale' ? (
                  <LeadModal
                    kind="contact"
                    title="Talk to sales"
                    description="Tell us about your team and we will tailor a Scale rollout."
                    triggerLabel={tier.cta}
                    triggerClassName={`mt-8 w-full text-center ${tier.highlighted ? 'btn-primary' : 'btn-ghost-dark'}`}
                    fields={['name', 'email', 'company', 'phone', 'message']}
                  />
                ) : (
                  <Link
                    href={tier.ctaHref}
                    className={`mt-8 w-full text-center ${tier.highlighted ? 'btn-primary' : 'btn-ghost-dark'}`}
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--brand-shadow-sm)]">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-[var(--brand-ink)]">Feature comparison</h3>
            <p className="text-xs text-[var(--brand-slate-muted)]">
              A full glance at what each plan unlocks.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream-2)]">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-[var(--brand-slate)]">Feature</th>
                  <th className="px-6 py-3 font-semibold text-[var(--brand-slate)]">Starter</th>
                  <th className="px-6 py-3 font-semibold text-[var(--brand-ink)]">Pro</th>
                  <th className="px-6 py-3 font-semibold text-[var(--brand-slate)]">Scale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARE.map((row) => (
                  <tr key={row.label}>
                    <td className="px-6 py-3 font-medium text-[var(--brand-ink)]">{row.label}</td>
                    {row.rows.map((v, i) => (
                      <td key={i} className="px-6 py-3 text-center">
                        {typeof v === 'boolean' ? (
                          v ? (
                            <Check className="h-4 w-4 text-[var(--brand-orange-600)] mx-auto" />
                          ) : (
                            <Minus className="h-4 w-4 text-slate-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-[var(--brand-slate)]">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
