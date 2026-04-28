'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bot,
  Calendar,
  ClipboardList,
  Loader2,
  Phone,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  AppPageHeader,
  ConsolePanel,
  EmptyState,
  OpsButton,
  RightRail,
  SegmentedFilterBar,
  StatusBadge,
  TimelineList,
  opsButtonClass,
} from '@/components/ops/ui';
import { cn, formatDateTimeLabel, humanizeToken, parseJsonSafely } from '@/lib/ops';

interface Segment {
  id: string;
  seq: number;
  speaker: string;
  text: string;
  created_at: string;
}

interface EventRow {
  id: string;
  event_type: string;
  payload_json: string | null;
  source?: string | null;
  created_at: string;
}

interface ToolInvocationRow {
  id: string;
  tool_name: string;
  request_json: string | null;
  response_json: string | null;
  status: string;
  created_at: string;
}

interface BookingRow {
  id: string;
  booking_type: string;
  status: string;
  notes: string | null;
  scheduled_start: string | null;
  job_id: string | null;
}

interface StaffTaskRow {
  id: string;
  task_type: string;
  status: string;
  title: string;
  priority: string;
  created_at: string;
  assigned_to_plumber_id: string | null;
}

type CallRecord = Record<string, unknown>;

const reviewTabs = [
  { value: 'summary', label: 'Summary' },
  { value: 'events', label: 'Events' },
  { value: 'tools', label: 'Tools' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'staff', label: 'Staff tasks' },
] as const;

function dispositionTone(disposition: string | null | undefined) {
  if (!disposition) return 'neutral' as const;
  if (disposition === 'emergency') return 'danger' as const;
  if (disposition === 'spam') return 'muted' as const;
  if (disposition === 'callback_booked' || disposition === 'quote_visit_booked') return 'success' as const;
  if (disposition === 'follow_up_needed') return 'warning' as const;
  return 'brand' as const;
}

function compactJson(value: string | null | undefined, maxLength = 360) {
  if (!value?.trim()) return '—';
  const parsed = parseJsonSafely<unknown>(value);
  const text = parsed ? JSON.stringify(parsed, null, 2) : value;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export default function ReceptionistCallDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [detail, setDetail] = useState<{
    call: CallRecord;
    segments: Segment[];
    events: EventRow[];
    bookings: BookingRow[];
    toolInvocations: ToolInvocationRow[];
    staffTasks: StaffTaskRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [activeTab, setActiveTab] = useState<(typeof reviewTabs)[number]['value']>('summary');

  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/receptionist/calls/${id}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setDetail({
      call: data.call,
      segments: data.segments || [],
      events: data.events || [],
      bookings: data.bookings || [],
      toolInvocations: data.toolInvocations || [],
      staffTasks: data.staffTasks || [],
    });
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const runAction = async (path: string, method = 'POST') => {
    setBusy(true);
    setActionMsg('');
    try {
      const res = await fetch(path, { method });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActionMsg('Saved.');
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const runStaffHandoff = async (action: string) => {
    setBusy(true);
    setActionMsg('');
    try {
      const res = await fetch(`/api/receptionist/calls/${id}/staff-handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.error) throw new Error(typeof data.error === 'string' ? data.error : 'Staff action failed');
      setActionMsg('Saved.');
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--ops-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--ops-brand)]" aria-hidden />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--ops-bg)] px-4">
        <EmptyState
          title="Call detail unavailable"
          description={error || 'This receptionist call could not be loaded.'}
          action={<Link href="/receptionist" className={opsButtonClass('primary')}>Back to receptionist</Link>}
          icon={Bot}
        />
      </div>
    );
  }

  const { call, segments, events, bookings, toolInvocations, staffTasks } = detail;
  const extracted = parseJsonSafely<Record<string, unknown>>(call.extracted_json as string | null);
  const callMeta = parseJsonSafely<Record<string, unknown>>(call.receptionist_meta_json as string | null);
  const completeness = callMeta?.completeness as
    | { sufficient?: boolean; missingLabels?: string[]; items?: { key: string; ok: boolean; detail?: string }[] }
    | undefined;
  const disposition = call.disposition as string | null;
  const isEmergency = disposition === 'emergency';
  const isRetell = call.provider === 'retell';

  const transcriptItems = segments.length
    ? segments.map((segment) => ({
        id: segment.id,
        title: humanizeToken(segment.speaker),
        body: segment.text,
        meta: formatDateTimeLabel(segment.created_at),
        tone:
          segment.speaker.toLowerCase().includes('assistant') || segment.speaker.toLowerCase().includes('ai')
            ? ('brand' as const)
            : segment.speaker.toLowerCase().includes('customer') || segment.speaker.toLowerCase().includes('caller')
              ? ('warning' as const)
              : ('neutral' as const),
      }))
    : [];

  const tabContent = (() => {
    if (activeTab === 'summary') {
      return (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">AI summary</p>
            <p className="mt-3 text-sm leading-6 text-[var(--ops-text)]">{(call.ai_summary as string) || 'No summary yet.'}</p>
          </div>
          <div className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Recommended next step</p>
            <p className="mt-3 text-sm leading-6 text-[var(--ops-text)]">
              {(call.recommended_next_step as string) || 'Office review recommended.'}
            </p>
          </div>
          {callMeta?.caseRecord && typeof callMeta.caseRecord === 'object' ? (
            <div className="rounded-[24px] border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Best available case record</p>
              <p className="mt-3 text-sm font-semibold text-[var(--ops-text)]">
                {String((callMeta.caseRecord as { canonicalIssueSummary?: string }).canonicalIssueSummary || '—')}
              </p>
              {Array.isArray((callMeta.caseRecord as { missingCriticalFields?: string[] }).missingCriticalFields) &&
              (callMeta.caseRecord as { missingCriticalFields: string[] }).missingCriticalFields.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ops-warning-ink)]">Needs confirmation</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ops-warning-ink)]">
                    {(callMeta.caseRecord as { missingCriticalFields: string[] }).missingCriticalFields.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {callMeta?.callerLinkage && typeof callMeta.callerLinkage === 'object' ? (
            <div className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">CRM linkage</p>
              <p className="mt-3 text-sm text-[var(--ops-text)]">
                Outcome: {humanizeToken(String((callMeta.callerLinkage as { outcome?: string }).outcome || 'unknown'))}
              </p>
              {(callMeta.callerLinkage as { customerId?: string }).customerId ? (
                <p className="mt-2 text-xs font-mono text-[var(--ops-muted)]">
                  Customer {(callMeta.callerLinkage as { customerId: string }).customerId}
                </p>
              ) : null}
              {(callMeta.callerLinkage as { leadId?: string }).leadId ? (
                <p className="mt-1 text-xs font-mono text-[var(--ops-muted)]">
                  Lead {(callMeta.callerLinkage as { leadId: string }).leadId}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    if (activeTab === 'events') {
      return events.length ? (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ops-text)]">{humanizeToken(event.event_type)}</p>
                  <p className="mt-1 text-xs text-[var(--ops-muted)]">{event.source || 'system'} · {formatDateTimeLabel(event.created_at)}</p>
                </div>
                <StatusBadge tone="neutral" mono>{event.id}</StatusBadge>
              </div>
              <pre className="mt-3 overflow-auto rounded-[18px] bg-[var(--ops-surface-subtle)] px-4 py-3 text-xs leading-6 text-[var(--ops-muted)]">
                {compactJson(event.payload_json)}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No event timeline yet"
          description="Webhook or orchestration events will show up here as the receptionist call flows through the system."
          icon={Calendar}
        />
      );
    }

    if (activeTab === 'tools') {
      return toolInvocations.length ? (
        <div className="space-y-3">
          {toolInvocations.map((tool) => (
            <div key={tool.id} className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ops-text)]">{humanizeToken(tool.tool_name)}</p>
                  <p className="mt-1 text-xs text-[var(--ops-muted)]">{formatDateTimeLabel(tool.created_at)}</p>
                </div>
                <StatusBadge tone={tool.status === 'success' ? 'success' : tool.status === 'error' ? 'danger' : 'neutral'}>
                  {humanizeToken(tool.status)}
                </StatusBadge>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[18px] bg-[var(--ops-surface-subtle)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Request</p>
                  <pre className="mt-2 overflow-auto text-xs leading-6 text-[var(--ops-muted)]">{compactJson(tool.request_json)}</pre>
                </div>
                <div className="rounded-[18px] bg-[var(--ops-surface-subtle)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Response</p>
                  <pre className="mt-2 overflow-auto text-xs leading-6 text-[var(--ops-muted)]">{compactJson(tool.response_json)}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No tool invocations recorded"
          description="When the receptionist uses downstream tools, the request and response context will appear here."
          icon={Bot}
        />
      );
    }

    if (activeTab === 'bookings') {
      return bookings.length ? (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ops-text)]">{humanizeToken(booking.booking_type)}</p>
                  <p className="mt-1 text-xs text-[var(--ops-muted)]">
                    {booking.scheduled_start ? formatDateTimeLabel(booking.scheduled_start) : 'Not scheduled yet'}
                  </p>
                </div>
                <StatusBadge tone={booking.status === 'booked' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'warning'}>
                  {humanizeToken(booking.status)}
                </StatusBadge>
              </div>
              {booking.notes ? <p className="mt-3 text-sm leading-6 text-[var(--ops-muted)]">{booking.notes}</p> : null}
              {booking.job_id ? <p className="mt-3 text-xs font-mono text-[var(--ops-muted)]">Job {booking.job_id}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No bookings created"
          description="Callback or quote-visit bookings attached to this call will appear here."
          icon={Calendar}
        />
      );
    }

    return staffTasks.length ? (
      <div className="space-y-3">
        {staffTasks.map((task) => (
          <div key={task.id} className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ops-text)]">{task.title}</p>
                <p className="mt-1 text-xs text-[var(--ops-muted)]">
                  {humanizeToken(task.task_type)} · {formatDateTimeLabel(task.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={task.priority === 'urgent' ? 'danger' : 'neutral'}>
                  {humanizeToken(task.priority)}
                </StatusBadge>
                <StatusBadge tone={task.status === 'open' ? 'warning' : 'success'}>
                  {humanizeToken(task.status)}
                </StatusBadge>
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState
        title="No staff tasks created"
        description="Escalated office tasks for this call will show here when the workflow needs a human owner."
        icon={Users}
      />
    );
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
          <AppPageHeader
            eyebrow="Receptionist / Call Review"
            icon={Bot}
            title={(call.caller_name as string) || 'Unknown caller'}
            description={`${(call.from_phone as string) || 'No callback number'} · ${formatDateTimeLabel(call.started_at as string)}`}
            actions={
              <>
                <Link href="/receptionist" className={opsButtonClass('ghost')}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
                <Link href={`/estimates/new?receptionist_call_id=${encodeURIComponent(id)}`} className={opsButtonClass('primary')}>
                  <ClipboardList className="h-4 w-4" />
                  New estimate
                </Link>
              </>
            }
          >
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="neutral">{humanizeToken(String(call.provider || 'mock'))}</StatusBadge>
              <StatusBadge tone="neutral">{humanizeToken(String(call.status || 'unknown'))}</StatusBadge>
              {disposition ? (
                <StatusBadge tone={dispositionTone(disposition)}>{humanizeToken(disposition)}</StatusBadge>
              ) : null}
              {call.provider_call_id ? <StatusBadge tone="muted" mono>Provider {String(call.provider_call_id)}</StatusBadge> : null}
              {call.recording_url ? (
                <a href={String(call.recording_url)} target="_blank" rel="noreferrer" className={opsButtonClass('secondary', 'sm')}>
                  Open recording
                </a>
              ) : null}
            </div>
          </AppPageHeader>

          {actionMsg ? (
            <div
              className={cn(
                'rounded-[24px] px-4 py-3 text-sm',
                actionMsg === 'Saved.'
                  ? 'border border-[var(--ops-success-soft-border)] bg-[var(--ops-success-soft)] text-[var(--ops-success-ink)]'
                  : 'border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] text-[var(--ops-danger-ink)]',
              )}
            >
              {actionMsg}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
            <div className="space-y-6">
              <ConsolePanel
                title="Transcript review"
                description="Use the speaker timeline to verify what the receptionist actually captured before taking action."
              >
                {transcriptItems.length ? (
                  <TimelineList items={transcriptItems} />
                ) : (
                  <EmptyState
                    title="Transcript not available"
                    description="This call does not have segmented transcript lines yet, so only the AI summary is available."
                    icon={Bot}
                  />
                )}
              </ConsolePanel>

              <ConsolePanel
                title="Evidence and workflow detail"
                description="Move between the summary, event trail, tools, bookings, and staff tasks without leaving the review surface."
              >
                <div className="mb-5">
                  <SegmentedFilterBar
                    value={activeTab}
                    onChange={(value) => setActiveTab(value as (typeof reviewTabs)[number]['value'])}
                    options={reviewTabs.map((tab) => ({
                      value: tab.value,
                      label: tab.label,
                      count:
                        tab.value === 'events'
                          ? events.length
                          : tab.value === 'tools'
                            ? toolInvocations.length
                            : tab.value === 'bookings'
                              ? bookings.length
                              : tab.value === 'staff'
                                ? staffTasks.length
                                : undefined,
                    }))}
                  />
                </div>
                {tabContent}
              </ConsolePanel>
            </div>

            <RightRail>
              <ConsolePanel title="Structured extraction" description="Caller details, issue framing, and visit context stay pinned while you review the transcript.">
                <div className="space-y-3 text-sm">
                  <div className="rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Caller</p>
                    <p className="mt-1 text-[var(--ops-text)]">
                      {String(extracted?.callerName || call.caller_name || 'Unknown caller')}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[var(--ops-muted)]">
                      {String(extracted?.phone || call.from_phone || 'No number')}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-[var(--ops-border)] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Issue</p>
                    <p className="mt-1 text-[var(--ops-text)]">
                      {String(extracted?.issueDescription || extracted?.issueType || call.lead_issue || call.ai_summary || 'Unknown issue')}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-[var(--ops-border)] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Service address</p>
                    <p className="mt-1 text-[var(--ops-text)]">{String(extracted?.address || 'Needs confirmation')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {extracted?.urgency ? (
                      <StatusBadge tone={String(extracted.urgency).includes('emergency') ? 'danger' : 'warning'}>
                        {humanizeToken(String(extracted.urgency))}
                      </StatusBadge>
                    ) : null}
                    {completeness?.sufficient === false ? (
                      <StatusBadge tone="warning">Needs missing details</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Capture complete</StatusBadge>
                    )}
                  </div>
                </div>
              </ConsolePanel>

              <ConsolePanel title="Safety and quality" description="Keep the operational priority visible while deciding the right human handoff.">
                <div className="space-y-3 text-sm">
                  {isEmergency ? (
                    <div className="rounded-[20px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-[var(--ops-danger-ink)]">
                      <div className="flex items-center gap-2 font-semibold">
                        <ShieldAlert className="h-4 w-4" />
                        Emergency flagged
                      </div>
                      <p className="mt-2 leading-6">
                        Prioritize on-call dispatch and confirm safety steps before anything else.
                      </p>
                    </div>
                  ) : null}
                  {callMeta?.callerBehavior === 'abusive_but_legitimate' ? (
                    <div className="rounded-[20px] border border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] px-4 py-3 text-[var(--ops-warning-ink)]">
                      <div className="flex items-center gap-2 font-semibold">
                        <Ban className="h-4 w-4" />
                        Abusive but legitimate caller
                      </div>
                      <p className="mt-2 leading-6">Keep the handoff crisp and human. The plumbing issue still needs attention.</p>
                    </div>
                  ) : null}
                  {completeness ? (
                    <div className="rounded-[20px] border border-[var(--ops-border)] bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Data completeness</p>
                      <p className="mt-1 text-[var(--ops-text)]">
                        {completeness.sufficient ? 'Critical fields are present.' : 'Critical fields are missing.'}
                      </p>
                      {!completeness.sufficient && Array.isArray(completeness.missingLabels) ? (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--ops-warning-ink)]">
                          {completeness.missingLabels.map((label) => (
                            <li key={label}>{label}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Action rail" description="All high-signal office actions stay sticky so you can operate directly from the review workstation.">
                <div className="grid gap-2">
                  <OpsButton type="button" disabled={busy} onClick={() => void runAction(`/api/receptionist/calls/${id}/lead`)} variant="primary">
                    <UserPlus className="h-4 w-4" />
                    Create or link lead
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runAction(`/api/receptionist/calls/${id}/book-callback`)} variant="secondary">
                    <Phone className="h-4 w-4" />
                    Book callback
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runAction(`/api/receptionist/calls/${id}/book-quote`)} variant="secondary">
                    <Calendar className="h-4 w-4" />
                    Book quote visit
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runAction(`/api/receptionist/calls/${id}/emergency`)} variant="danger">
                    <AlertTriangle className="h-4 w-4" />
                    Mark emergency
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runAction(`/api/receptionist/calls/${id}/spam`)} variant="warning">
                    <Ban className="h-4 w-4" />
                    Mark spam
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runAction(`/api/receptionist/calls/${id}/reprocess`)} variant="ghost">
                    <RefreshCw className="h-4 w-4" />
                    Reprocess
                  </OpsButton>
                  {isRetell && call.provider_call_id ? (
                    <OpsButton
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(`/api/receptionist/providers/retell/sync/${id}`)}
                      variant="ghost"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Sync from Retell
                    </OpsButton>
                  ) : null}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Staff handoff" description="Escalate or resolve office workflow states without bouncing out to a separate admin surface.">
                <div className="grid gap-2">
                  <OpsButton type="button" disabled={busy} onClick={() => void runStaffHandoff('assign_on_call')} variant="secondary">
                    Assign on-call
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runStaffHandoff('urgent_callback_task')} variant="warning">
                    Urgent callback
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runStaffHandoff('dispatch_review')} variant="secondary">
                    Dispatch review
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runStaffHandoff('escalate_emergency')} variant="danger">
                    Escalate emergency
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runStaffHandoff('link_customer_ack')} variant="ghost">
                    Ack CRM link
                  </OpsButton>
                  <OpsButton type="button" disabled={busy} onClick={() => void runStaffHandoff('mark_resolved')} variant="secondary">
                    Mark resolved
                  </OpsButton>
                </div>
              </ConsolePanel>
            </RightRail>
          </div>
        </div>
      </main>
    </div>
  );
}
