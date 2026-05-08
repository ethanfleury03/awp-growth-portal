'use client';

import { useMemo, useState } from 'react';
import {
  AppPageHeader,
  ConsolePanel,
  KpiStrip,
  OpsButton,
  OpsInput,
  OpsTextarea,
  StatCard,
  StatusBadge,
} from '@/components/ops/ui';
import { KnowledgeBasePanel } from '@/components/awp/knowledge-base-panel';
import { ReusableArchitecturePanel } from '@/components/awp/reusable-architecture-panel';
import { AiUsageCostPanel } from '@/components/awp/ai-usage-cost-panel';
import { awpBusinessProfile } from '@/lib/awp/config';
import { Building2, Check, KeyRound, Save, Settings, Sparkles, Wrench } from 'lucide-react';

type BusinessProfileState = {
  businessName: string;
  shortName: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  businessType: string;
  primaryRegion: string;
  coreOffer: string;
};

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<BusinessProfileState>({
    businessName: awpBusinessProfile.businessName,
    shortName: awpBusinessProfile.shortName,
    website: awpBusinessProfile.website,
    address: awpBusinessProfile.address,
    phone: awpBusinessProfile.phone,
    email: awpBusinessProfile.email,
    businessType: awpBusinessProfile.businessType,
    primaryRegion: awpBusinessProfile.primaryRegion,
    coreOffer: awpBusinessProfile.coreOffer,
  });

  const differentiators = useMemo(() => awpBusinessProfile.differentiators.join('\n'), []);
  const aiContext = useMemo(() => awpBusinessProfile.aiContext.join('\n'), []);

  function save() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
          <AppPageHeader
            icon={Settings}
            eyebrow="Settings / Business Profile"
            title="AWP Business Profile"
            description="Centralized profile used by the Growth Portal labels, AI context, templates, and demo reporting."
            actions={
              <OpsButton type="button" variant="primary" onClick={save}>
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Saved locally' : 'Save View'}
              </OpsButton>
            }
          />

          <KpiStrip className="xl:grid-cols-4">
            <StatCard label="Business" value={profile.shortName} meta={profile.businessType} tone="brand" icon={Building2} />
            <StatCard label="Region" value="Adirondacks" meta={profile.primaryRegion} tone="success" icon={Sparkles} />
            <StatCard label="AI Context" value={awpBusinessProfile.aiContext.length} meta="Reusable context anchors" tone="warning" icon={KeyRound} />
            <StatCard label="Legacy Ops Tools" value="Hidden" meta="Available in code, not owner nav" tone="neutral" icon={Wrench} />
          </KpiStrip>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <ConsolePanel title="Business Profile" description="This is the AWP-specific profile for this fork. Future clients should get their own config profile.">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['businessName', 'Business name'],
                    ['shortName', 'Short name'],
                    ['website', 'Website'],
                    ['phone', 'Phone'],
                    ['email', 'Email'],
                    ['businessType', 'Business type'],
                    ['primaryRegion', 'Primary region'],
                    ['coreOffer', 'Core offer'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">{label}</label>
                      <OpsInput
                        value={profile[key as keyof typeof profile]}
                        onChange={(event) => setProfile({ ...profile, [key]: event.target.value })}
                      />
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Address</label>
                    <OpsInput value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} />
                  </div>
                </div>
              </ConsolePanel>

              <ConsolePanel title="Differentiators and AI Guardrails" description="These inputs keep templates client-specific without hardcoding claims across the app.">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Key differentiators</label>
                    <OpsTextarea value={differentiators} readOnly rows={9} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">AI assistant context</label>
                    <OpsTextarea value={aiContext} readOnly rows={9} />
                  </div>
                </div>
                <div className="mt-5 rounded-[22px] border border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] px-4 py-3 text-sm leading-6 text-[var(--ops-warning-ink)]">
                  {awpBusinessProfile.aiGuardrail}
                </div>
              </ConsolePanel>

              <KnowledgeBasePanel />

              <ReusableArchitecturePanel />
            </div>

            <div className="space-y-6 xl:sticky xl:top-6">
              <AiUsageCostPanel />

              <ConsolePanel title="Business Contact" description="Default AWP contact details.">
                <div className="space-y-3 text-sm leading-6 text-[var(--ops-muted)]">
                  <p>
                    <span className="font-semibold text-[var(--ops-text)]">Website:</span>{' '}
                    <a href={profile.website} className="text-[var(--ops-brand)] hover:underline" target="_blank" rel="noreferrer">
                      {profile.website}
                    </a>
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--ops-text)]">Phone:</span> {profile.phone}
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--ops-text)]">Email:</span> {profile.email}
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--ops-text)]">Address:</span> {profile.address}
                  </p>
                </div>
              </ConsolePanel>

              <ConsolePanel title="Owner Portal Scope" description="The AWP portal is intentionally focused on growth work.">
                <div className="space-y-3 text-sm leading-6 text-[var(--ops-muted)]">
                  <p>
                    Calls, receptionist, dispatch, map, calendar, team, and jobs are outside the normal cabin-owner navigation.
                  </p>
                  <p>
                    The active owner workspace focuses on CRM pipeline, customers, estimates, invoices, marketing, outreach, AI assistance, reports, and settings.
                  </p>
                </div>
              </ConsolePanel>

              <ConsolePanel title="Integration Notes" description="Environment-sensitive integrations remain unchanged.">
                <div className="space-y-3">
                  {[
                    ['Clerk', 'Authentication and portal user context'],
                    ['SQLite / Neon Postgres', 'Local development or production database'],
                    ['Retell / Twilio', 'Legacy phone workflows hidden from this owner portal'],
                    ['Stripe', 'Payments and billing flows'],
                    ['R2', 'Attachment storage'],
                  ].map(([name, purpose]) => (
                    <div key={name} className="rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--ops-text)]">{name}</p>
                        <StatusBadge tone="neutral">Unchanged</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ops-muted)]">{purpose}</p>
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
