'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  Headphones,
  Link2,
  Loader2,
  PhoneCall,
  Play,
  RefreshCw,
  Settings,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  AppPageHeader,
  ConsolePanel,
  DataTable,
  EmptyState,
  KpiStrip,
  OpsButton,
  OpsSelect,
  RightRail,
  SegmentedFilterBar,
  StatCard,
  StatusBadge,
  TimelineList,
  opsButtonClass,
} from '@/components/ops/ui';
import { cn, formatDateTimeLabel, humanizeToken, parseJsonSafely } from '@/lib/ops';

interface ScenarioRow {
  id: string;
  name: string;
  description: string | null;
  expected_outcome: string | null;
}

interface DashboardCall {
  id: string;
  provider?: string | null;
  provider_status?: string | null;
  caller_name: string | null;
  from_phone: string | null;
  lead_issue: string | null;
  urgency: string | null;
  disposition: string | null;
  status: string;
  started_at: string;
  ai_summary: string | null;
  extracted_json: string | null;
  recommended_next_step: string | null;
  receptionist_meta_json?: string | null;
}

interface IntegrationSummary {
  providerType: string;
  retellReady: boolean;
  twilioReady: boolean;
  toolSecretSet: boolean;
  appBaseUrl: string;
  voiceWebhookPath: string;
  retellWebhookPath: string;
}

interface Extracted {
  callerName?: string | null;
  phone?: string | null;
  address?: string | null;
  issueType?: string | null;
  issueDescription?: string | null;
  urgency?: string;
  preferredCallbackWindow?: string | null;
  preferredVisitWindow?: string | null;
  emergencyDetected?: boolean;
  summary?: string;
  nextStep?: string;
}

const triageTabs = [
  { value: 'all', label: 'All calls' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'gaps', label: 'Data gaps' },
  { value: 'callback', label: 'Callbacks' },
  { value: 'booked', label: 'Booked' },
  { value: 'spam', label: 'Spam' },
  { value: 'abusive', label: 'Abusive legit' },
] as const;

function parseExtracted(json: string | null | undefined): Extracted | null {
  return parseJsonSafely<Extracted>(json);
}

function metaChecklistIncomplete(json: string | null | undefined) {
  const payload = parseJsonSafely<{ completeness?: { sufficient?: boolean } }>(json);
  return payload?.completeness?.sufficient === false;
}

function metaCallerBehavior(json: string | null | undefined) {
  const payload = parseJsonSafely<{ callerBehavior?: string }>(json);
  return payload?.callerBehavior || null;
}

function metaOperationalPriority(json: string | null | undefined) {
  const payload = parseJsonSafely<{ operationalPriority?: string }>(json);
  return payload?.operationalPriority || null;
}

function metaDuplicateResolutionLabel(json: string | null | undefined) {
  const payload = parseJsonSafely<{ duplicateResolution?: { outcome?: string } }>(json);
  const outcome = payload?.duplicateResolution?.outcome;
  if (!outcome || outcome === 'new_record') return null;
  if (outcome === 'cross_call_merged') return 'merged';
  if (outcome === 'same_call_reused') return 'reused';
  if (outcome === 'potential_duplicate_noted') return 'dup?';
  return outcome;
}

function dispositionTone(disposition: string | null | undefined) {
  if (!disposition) return 'neutral' as const;
  if (disposition === 'emergency') return 'danger' as const;
  if (disposition === 'spam') return 'muted' as const;
  if (disposition === 'callback_booked' || disposition === 'quote_visit_booked') return 'success' as const;
  if (disposition === 'follow_up_needed') return 'warning' as const;
  return 'brand' as const;
}

function behaviorTone(behavior: string | null) {
  if (behavior === 'abusive_but_legitimate') return 'warning' as const;
  if (behavior === 'spam_or_prank') return 'muted' as const;
  if (behavior === 'emergency_legitimate') return 'danger' as const;
  return 'neutral' as const;
}

function buildQueueCardIssue(call: DashboardCall, extracted: Extracted | null) {
  return extracted?.issueDescription || extracted?.issueType || call.lead_issue || call.ai_summary || 'Issue still being determined';
}

export default function ReceptionistDashboardPage() {
  const [stats, setStats] = useState({
    totalCalls: 0,
    activeCalls: 0,
    callbackBookings: 0,
    quoteVisitBookings: 0,
    emergenciesFlagged: 0,
    followUpNeeded: 0,
    spamCalls: 0,
    incompleteChecklist: 0,
    urgentActionNeeded: 0,
    abusiveButLegitimate: 0,
    crossCallDuplicatesMerged: 0,
    openUrgentStaffTasks: 0,
  });
  const [recentCalls, setRecentCalls] = useState<DashboardCall[]>([]);
  const [integration, setIntegration] = useState<IntegrationSummary | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<{
    transcript_text: string | null;
    status: string;
    extracted_json: string | null;
    recommended_next_step: string | null;
    disposition: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [triageFilter, setTriageFilter] = useState<(typeof triageTabs)[number]['value']>('all');
  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeCallIdRef.current = activeCallId;
  }, [activeCallId]);

  const loadDashboard = useCallback(async () => {
    const res = await fetch('/api/receptionist/dashboard');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setStats(data.stats);
    setRecentCalls(data.recentCalls || []);
    setIntegration(data.integration ?? null);
  }, []);

  const loadScenarios = useCallback(async () => {
    const res = await fetch('/api/receptionist/scenarios');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const list = data.scenarios || [];
    setScenarios(list);
    setScenarioId((previous) => previous || list[0]?.id || '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadDashboard(), loadScenarios()]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDashboard, loadScenarios]);

  useEffect(() => {
    const id = setInterval(() => {
      void loadDashboard();
    }, 5000);
    return () => clearInterval(id);
  }, [loadDashboard]);

  const refreshActiveDetail = useCallback(async (callId: string) => {
    const res = await fetch(`/api/receptionist/calls/${callId}`);
    const data = await res.json();
    if (data.error) return;
    setActiveDetail({
      transcript_text: data.call?.transcript_text ?? null,
      status: data.call?.status ?? '',
      extracted_json: data.call?.extracted_json ?? null,
      recommended_next_step: data.call?.recommended_next_step ?? null,
      disposition: data.call?.disposition ?? null,
    });
  }, []);

  useEffect(() => {
    if (!activeCallId) {
      setActiveDetail(null);
      return;
    }
    void refreshActiveDetail(activeCallId);
  }, [activeCallId, refreshActiveDetail]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      clearInterval(streamRef.current);
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const startMock = async () => {
    if (!scenarioId) return;
    setError('');
    setBusy(true);
    stopStream();
    try {
      const res = await fetch('/api/receptionist/mock/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActiveCallId(data.call.id);
      await refreshActiveDetail(data.call.id);
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start failed');
    } finally {
      setBusy(false);
    }
  };

  const advanceOnce = async () => {
    if (!activeCallId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/receptionist/mock/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCallId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await refreshActiveDetail(activeCallId);
      if (data.done && data.autoCompleted) {
        setActiveCallId(null);
        stopStream();
      }
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Advance failed');
    } finally {
      setBusy(false);
    }
  };

  const endMock = async () => {
    if (!activeCallId) return;
    setBusy(true);
    stopStream();
    try {
      const res = await fetch('/api/receptionist/mock/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCallId, fastForwardRemaining: true }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActiveCallId(null);
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'End failed');
    } finally {
      setBusy(false);
    }
  };

  const playScenario = () => {
    const id = activeCallIdRef.current;
    if (!id || streaming) return;
    setStreaming(true);
    streamRef.current = setInterval(() => {
      void (async () => {
        const callId = activeCallIdRef.current;
        if (!callId) {
          stopStream();
          return;
        }
        const res = await fetch('/api/receptionist/mock/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId }),
        });
        const data = await res.json();
        if (data.error) {
          stopStream();
          return;
        }
        await refreshActiveDetail(callId);
        if (data.done) {
          stopStream();
          if (data.autoCompleted) setActiveCallId(null);
          await loadDashboard();
        }
      })();
    }, 900);
  };

  const reprocessLatest = async () => {
    const latest = recentCalls[0];
    if (!latest?.id) {
      setError('No calls to reprocess yet.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/receptionist/calls/${latest.id}/reprocess`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reprocess failed');
    } finally {
      setBusy(false);
    }
  };

  const triageCounts = useMemo(() => {
    return {
      all: recentCalls.length,
      urgent: recentCalls.filter(
        (call) =>
          call.disposition === 'emergency' ||
          metaOperationalPriority(call.receptionist_meta_json ?? null)?.startsWith('emergency') ||
          metaOperationalPriority(call.receptionist_meta_json ?? null) === 'urgent_follow_up',
      ).length,
      gaps: recentCalls.filter((call) => metaChecklistIncomplete(call.receptionist_meta_json ?? null)).length,
      callback: recentCalls.filter((call) => call.disposition === 'callback_booked').length,
      booked: recentCalls.filter((call) => call.disposition === 'quote_visit_booked').length,
      spam: recentCalls.filter(
        (call) =>
          call.disposition === 'spam' || metaCallerBehavior(call.receptionist_meta_json ?? null) === 'spam_or_prank',
      ).length,
      abusive: recentCalls.filter(
        (call) => metaCallerBehavior(call.receptionist_meta_json ?? null) === 'abusive_but_legitimate',
      ).length,
    };
  }, [recentCalls]);

  const filteredCalls = useMemo(() => {
    return recentCalls.filter((call) => {
      if (triageFilter === 'all') return true;
      if (triageFilter === 'urgent') {
        return (
          call.disposition === 'emergency' ||
          metaOperationalPriority(call.receptionist_meta_json ?? null)?.startsWith('emergency') ||
          metaOperationalPriority(call.receptionist_meta_json ?? null) === 'urgent_follow_up'
        );
      }
      if (triageFilter === 'gaps') return metaChecklistIncomplete(call.receptionist_meta_json ?? null);
      if (triageFilter === 'callback') return call.disposition === 'callback_booked';
      if (triageFilter === 'booked') return call.disposition === 'quote_visit_booked';
      if (triageFilter === 'spam') {
        return (
          call.disposition === 'spam' || metaCallerBehavior(call.receptionist_meta_json ?? null) === 'spam_or_prank'
        );
      }
      if (triageFilter === 'abusive') {
        return metaCallerBehavior(call.receptionist_meta_json ?? null) === 'abusive_but_legitimate';
      }
      return true;
    });
  }, [recentCalls, triageFilter]);

  const transcriptItems = useMemo(() => {
    const rawLines = (activeDetail?.transcript_text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return rawLines.map((line, index) => {
      const speakerMatch = line.match(/^([^:]+):\s*(.*)$/);
      const speaker = speakerMatch?.[1]?.trim() || `Line ${index + 1}`;
      const text = speakerMatch?.[2]?.trim() || line;
      const normalized = speaker.toLowerCase();
      const tone =
        normalized.includes('customer') || normalized.includes('caller')
          ? ('warning' as const)
          : normalized.includes('assistant') || normalized.includes('ai')
            ? ('brand' as const)
            : ('neutral' as const);
      return {
        id: `${index}-${speaker}`,
        title: speaker,
        body: text,
        meta: index === rawLines.length - 1 ? 'latest' : undefined,
        tone,
      };
    });
  }, [activeDetail?.transcript_text]);

  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId) || null;
  const focusCall = activeCallId ? recentCalls.find((call) => call.id === activeCallId) || recentCalls[0] : filteredCalls[0] || recentCalls[0];
  const focusExtracted = activeDetail ? parseExtracted(activeDetail.extracted_json) : parseExtracted(focusCall?.extracted_json);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
          <AppPageHeader
            eyebrow="Wave 1 / Receptionist"
            icon={Bot}
            title="AI Receptionist Command Center"
            description="Run live or mock calls, watch transcript progression, surface urgent follow-up, and hand clean CRM context back to the office."
            actions={
              <>
                <Link href="/calls" className={opsButtonClass('secondary')}>
                  Open call log
                </Link>
                <Link href="/receptionist/settings" className={opsButtonClass('primary')}>
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={integration?.retellReady ? 'success' : 'warning'}>
                Retell {integration?.retellReady ? 'ready' : 'not configured'}
              </StatusBadge>
              <StatusBadge tone={integration?.twilioReady ? 'success' : 'warning'}>
                Twilio {integration?.twilioReady ? 'present' : 'missing'}
              </StatusBadge>
              <StatusBadge tone={integration?.toolSecretSet ? 'success' : 'warning'}>
                Tool secret {integration?.toolSecretSet ? 'set' : 'missing'}
              </StatusBadge>
              <StatusBadge tone="neutral">Provider {humanizeToken(integration?.providerType || 'mock')}</StatusBadge>
              {integration?.appBaseUrl ? <StatusBadge tone="muted" mono>Base {integration.appBaseUrl}</StatusBadge> : null}
            </div>
          </AppPageHeader>

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <KpiStrip className="xl:grid-cols-6">
            <StatCard label="Active or mock" value={loading ? '…' : stats.activeCalls} meta="Current live session load" tone="brand" icon={Headphones} />
            <StatCard label="Urgent action" value={loading ? '…' : stats.urgentActionNeeded} meta="Needs human follow-up now" tone="danger" icon={ShieldAlert} />
            <StatCard label="Emergencies" value={loading ? '…' : stats.emergenciesFlagged} meta="Safety-flagged calls" tone="danger" icon={AlertTriangle} />
            <StatCard label="Callbacks" value={loading ? '…' : stats.callbackBookings} meta={`${stats.quoteVisitBookings} quote visits booked`} tone="success" icon={PhoneCall} />
            <StatCard label="Data gaps" value={loading ? '…' : stats.incompleteChecklist} meta={`${stats.crossCallDuplicatesMerged} duplicate merges`} tone="warning" icon={Sparkles} />
            <StatCard label="Spam / abusive" value={loading ? '…' : `${stats.spamCalls} / ${stats.abusiveButLegitimate}`} meta={`${stats.openUrgentStaffTasks} urgent staff tasks`} tone="neutral" icon={Link2} />
          </KpiStrip>

          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <ConsolePanel
                title="Queue and triage"
                description="Filter recent calls by urgency, data quality, or handoff outcome."
                action={<StatusBadge tone="neutral">{filteredCalls.length} visible</StatusBadge>}
              >
                <div className="space-y-4">
                  <SegmentedFilterBar
                    value={triageFilter}
                    onChange={(value) => setTriageFilter(value as (typeof triageTabs)[number]['value'])}
                    options={triageTabs.map((tab) => ({
                      value: tab.value,
                      label: tab.label,
                      count: triageCounts[tab.value],
                    }))}
                    className="w-full"
                  />

                  <div className="space-y-3">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-28 animate-pulse rounded-[24px] bg-[var(--ops-surface-subtle)]" />
                      ))
                    ) : filteredCalls.length === 0 ? (
                      <EmptyState
                        title="No calls in this triage view"
                        description="Run a mock scenario or switch filters to see recent receptionist activity."
                        icon={PhoneCall}
                      />
                    ) : (
                      filteredCalls.map((call) => {
                        const extracted = parseExtracted(call.extracted_json);
                        const issue = buildQueueCardIssue(call, extracted);
                        const callerBehavior = metaCallerBehavior(call.receptionist_meta_json ?? null);
                        const opPriority = metaOperationalPriority(call.receptionist_meta_json ?? null);
                        return (
                          <Link
                            key={call.id}
                            href={`/receptionist/${call.id}`}
                            className={cn(
                              'block rounded-[24px] border border-[var(--ops-border)] bg-white px-4 py-4 shadow-[var(--ops-shadow-soft)] transition-transform duration-150 hover:-translate-y-0.5',
                              activeCallId === call.id && 'border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)]',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--ops-text)]">
                                  {call.caller_name || extracted?.callerName || 'Unknown caller'}
                                </p>
                                <p className="mt-1 truncate text-xs font-mono text-[var(--ops-muted)]">
                                  {call.from_phone || extracted?.phone || 'No callback number'}
                                </p>
                              </div>
                              <StatusBadge tone={dispositionTone(call.disposition)}>
                                {humanizeToken(call.disposition || call.status)}
                              </StatusBadge>
                            </div>
                            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--ops-muted)]">{issue}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {metaChecklistIncomplete(call.receptionist_meta_json ?? null) ? (
                                <StatusBadge tone="warning">Data gaps</StatusBadge>
                              ) : null}
                              {callerBehavior ? (
                                <StatusBadge tone={behaviorTone(callerBehavior)}>{humanizeToken(callerBehavior)}</StatusBadge>
                              ) : null}
                              {opPriority?.startsWith('emergency') || opPriority === 'urgent_follow_up' ? (
                                <StatusBadge tone="danger">{humanizeToken(opPriority)}</StatusBadge>
                              ) : null}
                              {metaDuplicateResolutionLabel(call.receptionist_meta_json ?? null) ? (
                                <StatusBadge tone="sky">
                                  {humanizeToken(metaDuplicateResolutionLabel(call.receptionist_meta_json ?? null))}
                                </StatusBadge>
                              ) : null}
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs text-[var(--ops-muted)]">
                              <span>{humanizeToken(call.provider || 'mock')}</span>
                              <span className="font-mono">{formatDateTimeLabel(call.started_at)}</span>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              </ConsolePanel>

              <ConsolePanel
                title="Simulation mode"
                description="Keep demo tooling nearby without letting it dominate the primary operations surface."
                icon={Wand2}
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                      Scenario
                    </label>
                    <OpsSelect value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
                      {scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </OpsSelect>
                  </div>
                  {selectedScenario ? (
                    <div className="rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-4 py-3 text-sm text-[var(--ops-muted)]">
                      <p className="font-semibold text-[var(--ops-text)]">{selectedScenario.name}</p>
                      {selectedScenario.description ? (
                        <p className="mt-2 leading-6">{selectedScenario.description}</p>
                      ) : null}
                      {selectedScenario.expected_outcome ? (
                        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--ops-muted)]">
                          Expected outcome: <span className="text-[var(--ops-text)]">{humanizeToken(selectedScenario.expected_outcome)}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    <OpsButton type="button" disabled={busy || !scenarioId} onClick={() => void startMock()} variant="primary">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Start sample call
                    </OpsButton>
                    <OpsButton type="button" disabled={busy || !activeCallId} onClick={() => void advanceOnce()} variant="secondary">
                      <SkipForward className="h-4 w-4" />
                      Advance one line
                    </OpsButton>
                    <OpsButton type="button" disabled={!activeCallId || streaming} onClick={playScenario} variant="secondary">
                      <Sparkles className="h-4 w-4" />
                      Auto-play scenario
                    </OpsButton>
                    <OpsButton type="button" disabled={busy || !activeCallId} onClick={() => void endMock()} variant="warning">
                      End and save now
                    </OpsButton>
                    <OpsButton type="button" disabled={busy} onClick={() => void reprocessLatest()} variant="ghost">
                      <RefreshCw className="h-4 w-4" />
                      Reprocess latest call
                    </OpsButton>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeCallId ? <StatusBadge tone="brand" mono>Call {activeCallId}</StatusBadge> : <StatusBadge tone="neutral">No active call</StatusBadge>}
                    {streaming ? <StatusBadge tone="success">Auto-play running</StatusBadge> : null}
                    {activeDetail?.status ? <StatusBadge tone="neutral">{humanizeToken(activeDetail.status)}</StatusBadge> : null}
                  </div>
                </div>
              </ConsolePanel>
            </div>

            <div className="space-y-6">
              <ConsolePanel
                title="Live transcript"
                description="Speaker turns stream through the center pane, with the newest line always anchored in view."
                icon={Headphones}
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    {activeCallId ? <StatusBadge tone="brand">Active review</StatusBadge> : null}
                    {activeDetail?.disposition ? (
                      <StatusBadge tone={dispositionTone(activeDetail.disposition)}>
                        {humanizeToken(activeDetail.disposition)}
                      </StatusBadge>
                    ) : null}
                  </div>
                }
                contentClassName="max-h-[720px] overflow-auto"
              >
                {activeCallId ? (
                  <TimelineList
                    items={transcriptItems}
                    empty="Transcript will appear as the mock call advances."
                  />
                ) : (
                  <EmptyState
                    title="No live call selected"
                    description="Start a sample scenario from the left rail to stream a transcript here, or review a previous call below."
                    icon={Bot}
                  />
                )}
              </ConsolePanel>

              <ConsolePanel
                title="Recent call triage"
                description="Review outcomes, spot weak captures, and jump straight into detailed call review."
                action={
                  <Link href="/calls" className={opsButtonClass('ghost', 'sm')}>
                    Full call log
                  </Link>
                }
              >
                <DataTable
                  columns={[
                    { key: 'caller', label: 'Caller' },
                    { key: 'issue', label: 'Issue' },
                    { key: 'triage', label: 'Triage' },
                    { key: 'when', label: 'When' },
                    { key: 'actions', label: 'Review', align: 'right' },
                  ]}
                  footer={`Showing ${filteredCalls.length} of ${recentCalls.length} recent calls`}
                  minWidthClassName="min-w-[940px]"
                  className="border-0 shadow-none"
                >
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-[var(--ops-muted)]">
                        Loading receptionist activity…
                      </td>
                    </tr>
                  ) : filteredCalls.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-[var(--ops-muted)]">
                        No calls match this triage filter yet.
                      </td>
                    </tr>
                  ) : (
                    filteredCalls.map((call) => {
                      const extracted = parseExtracted(call.extracted_json);
                      const issue = buildQueueCardIssue(call, extracted);
                      const callerBehavior = metaCallerBehavior(call.receptionist_meta_json ?? null);
                      const opPriority = metaOperationalPriority(call.receptionist_meta_json ?? null);
                      return (
                        <tr key={call.id} className="align-top transition-colors hover:bg-[var(--ops-surface-subtle)]">
                          <td className="px-5 py-4">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[var(--ops-text)]">
                                {call.caller_name || extracted?.callerName || 'Unknown caller'}
                              </p>
                              <p className="text-xs font-mono text-[var(--ops-muted)]">
                                {call.from_phone || extracted?.phone || 'No number'}
                              </p>
                              <p className="text-xs text-[var(--ops-muted)]">
                                {humanizeToken(call.provider || 'mock')}
                                {call.provider_status ? ` · ${call.provider_status}` : ''}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="max-w-[320px]">
                              <p className="text-sm text-[var(--ops-text)]">{issue}</p>
                              {call.recommended_next_step ? (
                                <p className="mt-1 text-xs text-[var(--ops-muted)]">
                                  Next: {call.recommended_next_step}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex max-w-[250px] flex-wrap gap-2">
                              <StatusBadge tone={dispositionTone(call.disposition)}>
                                {humanizeToken(call.disposition || call.status)}
                              </StatusBadge>
                              {metaChecklistIncomplete(call.receptionist_meta_json ?? null) ? (
                                <StatusBadge tone="warning">Data gaps</StatusBadge>
                              ) : null}
                              {callerBehavior ? (
                                <StatusBadge tone={behaviorTone(callerBehavior)}>{humanizeToken(callerBehavior)}</StatusBadge>
                              ) : null}
                              {opPriority?.startsWith('emergency') || opPriority === 'urgent_follow_up' ? (
                                <StatusBadge tone="danger">{humanizeToken(opPriority)}</StatusBadge>
                              ) : null}
                              {metaDuplicateResolutionLabel(call.receptionist_meta_json ?? null) ? (
                                <StatusBadge tone="sky">
                                  {humanizeToken(metaDuplicateResolutionLabel(call.receptionist_meta_json ?? null))}
                                </StatusBadge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-xs text-[var(--ops-muted)]">
                            <p className="font-mono">{formatDateTimeLabel(call.started_at)}</p>
                            {call.urgency ? <p className="mt-1">{humanizeToken(call.urgency)}</p> : null}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link href={`/receptionist/${call.id}`} className={opsButtonClass('ghost', 'sm')}>
                              Review
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </DataTable>
              </ConsolePanel>
            </div>

            <RightRail>
              <ConsolePanel
                title="Live extraction"
                description="This rail stays focused on the latest structured context and the handoff-quality signal."
              >
                {focusCall ? (
                  <div className="space-y-4">
                    <div className="rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">
                            Focus call
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[var(--ops-text)]">
                            {focusCall.caller_name || focusExtracted?.callerName || 'Unknown caller'}
                          </p>
                          <p className="mt-1 text-xs font-mono text-[var(--ops-muted)]">
                            {focusCall.from_phone || focusExtracted?.phone || 'No callback number'}
                          </p>
                        </div>
                        <StatusBadge tone={dispositionTone(activeDetail?.disposition || focusCall.disposition)}>
                          {humanizeToken(activeDetail?.disposition || focusCall.disposition || focusCall.status)}
                        </StatusBadge>
                      </div>
                    </div>

                    <dl className="grid gap-3 text-sm">
                      <div className="rounded-[20px] border border-[var(--ops-border)] bg-white px-4 py-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Issue</dt>
                        <dd className="mt-1 text-[var(--ops-text)]">
                          {focusExtracted?.issueDescription || focusExtracted?.issueType || focusCall.lead_issue || focusCall.ai_summary || 'Still gathering details'}
                        </dd>
                      </div>
                      <div className="rounded-[20px] border border-[var(--ops-border)] bg-white px-4 py-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Service address</dt>
                        <dd className="mt-1 text-[var(--ops-text)]">{focusExtracted?.address || 'Needs confirmation'}</dd>
                      </div>
                      <div className="rounded-[20px] border border-[var(--ops-border)] bg-white px-4 py-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Recommended next step</dt>
                        <dd className="mt-1 text-[var(--ops-text)]">
                          {activeDetail?.recommended_next_step || focusCall.recommended_next_step || focusExtracted?.nextStep || 'Review transcript and hand off to office'}
                        </dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-2">
                      {focusExtracted?.urgency || focusCall.urgency ? (
                        <StatusBadge tone={(focusExtracted?.urgency || focusCall.urgency || '').includes('emergency') ? 'danger' : 'warning'}>
                          {humanizeToken(focusExtracted?.urgency || focusCall.urgency)}
                        </StatusBadge>
                      ) : null}
                      {metaChecklistIncomplete(focusCall.receptionist_meta_json ?? null) ? (
                        <StatusBadge tone="warning">Needs follow-up details</StatusBadge>
                      ) : (
                        <StatusBadge tone="success">Capture looks complete</StatusBadge>
                      )}
                      {metaCallerBehavior(focusCall.receptionist_meta_json ?? null) ? (
                        <StatusBadge tone={behaviorTone(metaCallerBehavior(focusCall.receptionist_meta_json ?? null))}>
                          {humanizeToken(metaCallerBehavior(focusCall.receptionist_meta_json ?? null))}
                        </StatusBadge>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No focus call yet"
                    description="The most recent or active call will surface here with structured extraction and handoff guidance."
                    icon={Sparkles}
                  />
                )}
              </ConsolePanel>

              <ConsolePanel title="Handoff shortcuts" description="Jump directly into the office action most likely to unblock the next human step.">
                <div className="grid gap-2">
                  <Link href={focusCall ? `/receptionist/${focusCall.id}` : '/calls'} className={opsButtonClass('primary')}>
                    Review full call
                  </Link>
                  <button type="button" disabled={busy} onClick={() => void reprocessLatest()} className={opsButtonClass('secondary')}>
                    <RefreshCw className="h-4 w-4" />
                    Reprocess latest
                  </button>
                </div>
              </ConsolePanel>

              <ConsolePanel title="Integration readiness" description="Live telephony status stays visible without overwhelming the core transcript workflow.">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-[20px] border border-[var(--ops-border)] bg-white px-4 py-3">
                    <span className="text-[var(--ops-muted)]">Retell</span>
                    <StatusBadge tone={integration?.retellReady ? 'success' : 'warning'}>
                      {integration?.retellReady ? 'Ready' : 'Not configured'}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center justify-between rounded-[20px] border border-[var(--ops-border)] bg-white px-4 py-3">
                    <span className="text-[var(--ops-muted)]">Twilio auth</span>
                    <StatusBadge tone={integration?.twilioReady ? 'success' : 'warning'}>
                      {integration?.twilioReady ? 'Present' : 'Missing'}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center justify-between rounded-[20px] border border-[var(--ops-border)] bg-white px-4 py-3">
                    <span className="text-[var(--ops-muted)]">Tool secret</span>
                    <StatusBadge tone={integration?.toolSecretSet ? 'success' : 'warning'}>
                      {integration?.toolSecretSet ? 'Set' : 'Missing'}
                    </StatusBadge>
                  </div>
                </div>
              </ConsolePanel>
            </RightRail>
          </div>
        </div>
      </main>
    </div>
  );
}
