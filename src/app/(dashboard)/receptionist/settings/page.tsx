'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, Save, Settings2 } from 'lucide-react';
import {
  AppPageHeader,
  ConsolePanel,
  OpsButton,
  OpsInput,
  OpsSelect,
  OpsTextarea,
  StatusBadge,
} from '@/components/ops/ui';
import { humanizeToken, parseJsonSafely } from '@/lib/ops';

interface SettingsRow {
  id: string;
  company_name: string | null;
  greeting: string | null;
  disclosure_enabled: number;
  recording_enabled: number;
  business_hours_json: string | null;
  after_hours_mode: string | null;
  allowed_actions_json: string | null;
  emergency_keywords_json: string | null;
  booking_rules_json: string | null;
  default_call_outcome_rules_json: string | null;
  provider_type: string;
  provider_config_json: string | null;
  internal_instructions: string | null;
  callback_booking_enabled: number;
  quote_visit_booking_enabled: number;
  retell_agent_id: string | null;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[22px] border border-[var(--ops-border)] bg-white px-4 py-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-[var(--ops-border-strong)] text-[var(--ops-brand)] focus:ring-[var(--ops-focus-ring)]"
      />
      <span className="block">
        <span className="block text-sm font-semibold text-[var(--ops-text)]">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-[var(--ops-muted)]">{description}</span>
      </span>
    </label>
  );
}

export default function ReceptionistSettingsPage() {
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/receptionist/settings');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!cancelled) {
          setSettings({
            ...data.settings,
            retell_agent_id: data.settings.retell_agent_id ?? null,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = <K extends keyof SettingsRow>(key: K, value: SettingsRow[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const validateJson = (label: string, raw: string | null) => {
    if (!raw || !raw.trim()) return null;
    try {
      JSON.parse(raw);
      return null;
    } catch {
      return `${label} must be valid JSON`;
    }
  };

  const save = async () => {
    if (!settings) return;
    const jsonErr =
      validateJson('Business hours', settings.business_hours_json) ||
      validateJson('Allowed actions', settings.allowed_actions_json) ||
      validateJson('Emergency keywords', settings.emergency_keywords_json) ||
      validateJson('Booking rules', settings.booking_rules_json) ||
      validateJson('Outcome rules', settings.default_call_outcome_rules_json) ||
      validateJson('Provider config', settings.provider_config_json);

    if (jsonErr) {
      setError(jsonErr);
      return;
    }

    setSaving(true);
    setError('');
    setOk('');
    try {
      const res = await fetch('/api/receptionist/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: settings.company_name ?? '',
          greeting: settings.greeting ?? '',
          disclosure_enabled: Boolean(settings.disclosure_enabled),
          recording_enabled: Boolean(settings.recording_enabled),
          business_hours_json: settings.business_hours_json,
          after_hours_mode: settings.after_hours_mode,
          allowed_actions_json: settings.allowed_actions_json,
          emergency_keywords_json: settings.emergency_keywords_json,
          booking_rules_json: settings.booking_rules_json,
          default_call_outcome_rules_json: settings.default_call_outcome_rules_json,
          provider_type: settings.provider_type,
          provider_config_json: settings.provider_config_json,
          internal_instructions: settings.internal_instructions,
          callback_booking_enabled: Boolean(settings.callback_booking_enabled),
          quote_visit_booking_enabled: Boolean(settings.quote_visit_booking_enabled),
          retell_agent_id: settings.retell_agent_id?.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(typeof data.error === 'string' ? data.error : 'Validation failed');
      setSettings(data.settings);
      setOk('Settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const businessHours = useMemo(
    () => parseJsonSafely<Record<string, unknown>>(settings?.business_hours_json),
    [settings?.business_hours_json],
  );
  const emergencyKeywords = useMemo(
    () => parseJsonSafely<string[]>(settings?.emergency_keywords_json),
    [settings?.emergency_keywords_json],
  );
  const allowedActions = useMemo(
    () => parseJsonSafely<string[]>(settings?.allowed_actions_json),
    [settings?.allowed_actions_json],
  );

  if (loading || !settings) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--ops-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--ops-brand)]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
          <AppPageHeader
            eyebrow="Receptionist / Settings"
            icon={Settings2}
            title="Receptionist policy and routing"
            description="Keep the day-to-day settings human-friendly, then tuck the raw JSON policy documents into an advanced section for power users."
            actions={
              <>
                <Link href="/receptionist" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[var(--ops-border-strong)] bg-white px-4 text-sm font-semibold text-[var(--ops-text)]">
                  <ArrowLeft className="h-4 w-4" />
                  Receptionist
                </Link>
                <OpsButton type="button" disabled={saving} onClick={() => void save()} variant="primary">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save settings
                </OpsButton>
              </>
            }
          >
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="neutral">Provider {humanizeToken(settings.provider_type)}</StatusBadge>
              {settings.retell_agent_id ? <StatusBadge tone="success">Retell agent linked</StatusBadge> : <StatusBadge tone="warning">Retell agent missing</StatusBadge>}
              <StatusBadge tone={settings.callback_booking_enabled ? 'success' : 'neutral'}>
                Callback booking {settings.callback_booking_enabled ? 'enabled' : 'off'}
              </StatusBadge>
              <StatusBadge tone={settings.quote_visit_booking_enabled ? 'success' : 'neutral'}>
                Quote visits {settings.quote_visit_booking_enabled ? 'enabled' : 'off'}
              </StatusBadge>
            </div>
          </AppPageHeader>

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}
          {ok ? (
            <div className="rounded-[24px] border border-[var(--ops-success-soft-border)] bg-[var(--ops-success-soft)] px-4 py-3 text-sm text-[var(--ops-success-ink)]">
              {ok}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <ConsolePanel
                title="Caller experience"
                description="Everything the homeowner hears or feels directly should be easy to understand and safe to edit."
                icon={Bot}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                      Company display name
                    </label>
                    <OpsInput value={settings.company_name || ''} onChange={(event) => updateField('company_name', event.target.value)} />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                      Greeting
                    </label>
                    <OpsTextarea
                      value={settings.greeting || ''}
                      onChange={(event) => updateField('greeting', event.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>

                  <ToggleRow
                    label="AI disclosure enabled"
                    description="Tell callers they are talking to an automated assistant before collecting service details."
                    checked={Boolean(settings.disclosure_enabled)}
                    onChange={(checked) => updateField('disclosure_enabled', checked ? 1 : 0)}
                  />
                  <ToggleRow
                    label="Call recording policy"
                    description="Surface the recording policy flag here even if recording is enforced elsewhere in telephony."
                    checked={Boolean(settings.recording_enabled)}
                    onChange={(checked) => updateField('recording_enabled', checked ? 1 : 0)}
                  />
                </div>
              </ConsolePanel>

              <ConsolePanel
                title="Routing and booking"
                description="Control after-hours behavior and whether the receptionist is allowed to create callback or quote-visit bookings."
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                      After-hours mode
                    </label>
                    <OpsInput
                      value={settings.after_hours_mode || ''}
                      onChange={(event) => updateField('after_hours_mode', event.target.value)}
                      placeholder="callback_queue, emergency_only, custom…"
                    />
                  </div>

                  <div className="rounded-[24px] border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Hours snapshot</p>
                    {businessHours ? (
                      <pre className="mt-3 overflow-auto text-xs leading-6 text-[var(--ops-muted)]">
                        {JSON.stringify(businessHours, null, 2)}
                      </pre>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--ops-muted)]">Business hours are empty. Use the advanced section below to define them.</p>
                    )}
                  </div>

                  <ToggleRow
                    label="Callback booking enabled"
                    description="Allow the receptionist to create callback tasks directly from the call review workflow."
                    checked={Boolean(settings.callback_booking_enabled)}
                    onChange={(checked) => updateField('callback_booking_enabled', checked ? 1 : 0)}
                  />
                  <ToggleRow
                    label="Quote visit booking enabled"
                    description="Allow the receptionist to create quote-visit bookings as a direct next step from the call."
                    checked={Boolean(settings.quote_visit_booking_enabled)}
                    onChange={(checked) => updateField('quote_visit_booking_enabled', checked ? 1 : 0)}
                  />
                </div>
              </ConsolePanel>

              <ConsolePanel
                title="Provider and guidance"
                description="Keep provider routing, agent identifiers, and internal instructions together so the office knows what powers live handling."
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                      Provider type
                    </label>
                    <OpsSelect value={settings.provider_type} onChange={(event) => updateField('provider_type', event.target.value)}>
                      <option value="mock">mock (local demo)</option>
                      <option value="retell">retell + Twilio (live)</option>
                      <option value="twilio">twilio (legacy stub)</option>
                      <option value="custom">custom</option>
                    </OpsSelect>
                    <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
                      Live calls still rely on Twilio webhooks and Retell SIP. This flag mainly controls UI and operational defaults.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                      Retell agent ID
                    </label>
                    <OpsInput
                      value={settings.retell_agent_id || ''}
                      onChange={(event) => updateField('retell_agent_id', event.target.value || null)}
                      placeholder="From the Retell dashboard"
                    />
                    <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
                      Overrides <code className="rounded bg-[var(--ops-surface-subtle)] px-1.5 py-0.5 font-mono text-xs">RETELL_AGENT_ID</code> when set.
                    </p>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                      Internal instructions
                    </label>
                    <OpsTextarea
                      value={settings.internal_instructions || ''}
                      onChange={(event) => updateField('internal_instructions', event.target.value)}
                      className="min-h-[140px]"
                    />
                  </div>
                </div>
              </ConsolePanel>

              <ConsolePanel
                title="Advanced JSON policy"
                description="Power-user configuration stays available, but it no longer overwhelms the primary settings experience."
              >
                <div className="space-y-4">
                  {[
                    {
                      title: 'Business hours JSON',
                      value: settings.business_hours_json || '',
                      onChange: (value: string) => updateField('business_hours_json', value),
                    },
                    {
                      title: 'Emergency keywords JSON array',
                      value: settings.emergency_keywords_json || '',
                      onChange: (value: string) => updateField('emergency_keywords_json', value),
                    },
                    {
                      title: 'Booking rules JSON',
                      value: settings.booking_rules_json || '',
                      onChange: (value: string) => updateField('booking_rules_json', value),
                    },
                    {
                      title: 'Default outcome rules JSON',
                      value: settings.default_call_outcome_rules_json || '',
                      onChange: (value: string) => updateField('default_call_outcome_rules_json', value),
                    },
                    {
                      title: 'Allowed actions JSON',
                      value: settings.allowed_actions_json || '',
                      onChange: (value: string) => updateField('allowed_actions_json', value),
                    },
                    {
                      title: 'Provider config JSON',
                      value: settings.provider_config_json || '',
                      onChange: (value: string) => updateField('provider_config_json', value),
                    },
                  ].map((field) => (
                    <details key={field.title} className="rounded-[24px] border border-[var(--ops-border)] bg-white px-4 py-4">
                      <summary className="cursor-pointer text-sm font-semibold text-[var(--ops-text)]">{field.title}</summary>
                      <div className="mt-4">
                        <OpsTextarea
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          className="min-h-[140px] font-mono text-xs leading-6"
                        />
                      </div>
                    </details>
                  ))}
                </div>
              </ConsolePanel>
            </div>

            <div className="space-y-6 xl:sticky xl:top-6">
              <ConsolePanel
                title="Policy snapshot"
                description="A quick operator summary of what the receptionist is currently allowed to do."
              >
                <div className="flex flex-wrap gap-2">
                  {allowedActions?.length ? (
                    allowedActions.map((action) => (
                      <StatusBadge key={action} tone="brand">{humanizeToken(action)}</StatusBadge>
                    ))
                  ) : (
                    <StatusBadge tone="neutral">No allowed-actions policy set</StatusBadge>
                  )}
                </div>
                {emergencyKeywords?.length ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Emergency keywords</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {emergencyKeywords.map((keyword) => (
                        <StatusBadge key={keyword} tone="warning">{keyword}</StatusBadge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </ConsolePanel>

              <ConsolePanel
                title="Operational guidance"
                description="Keep the purpose of these settings obvious while you tune the receptionist for live or demo use."
              >
                <ul className="space-y-3 text-sm leading-6 text-[var(--ops-muted)]">
                  <li>Default mode should be safe for demos first, then progressively tightened for live telephony.</li>
                  <li>Use the simple controls above for day-to-day changes and the advanced JSON only when the workflow truly needs it.</li>
                  <li>Whenever you change routing, save here first, then run a mock call from the main receptionist page to confirm behavior.</li>
                </ul>
              </ConsolePanel>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
