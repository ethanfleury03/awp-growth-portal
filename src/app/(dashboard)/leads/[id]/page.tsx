'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  AppPageHeader,
  ConsolePanel,
  DataTable,
  KpiStrip,
  StatCard,
  StatusBadge,
  opsButtonClass,
} from '@/components/ops/ui';
import { pipelineLabel, sourceFromSlug } from '@/lib/awp/config';
import { formatCurrency, formatDateLabel, parseJsonSafely } from '@/lib/ops';
import { ArrowLeft, Bot, CalendarClock, FileText, Loader2, Mail, MessageSquareText, Send, Users } from 'lucide-react';

type Row = Record<string, unknown>;
type LeadNote = {
  id: string;
  author_role: string;
  author_name: string | null;
  author_email: string | null;
  body: string;
  created_at: string;
};

function contextForLead(lead: Row) {
  return parseJsonSafely<Record<string, unknown>>(String(lead.lead_context_json || '')) || {};
}

function money(cents: unknown) {
  return formatCurrency(Number(cents || 0), { cents: true });
}

function noteAuthor(note: LeadNote) {
  return note.author_name || note.author_email || 'Team member';
}

function noteInitials(note: LeadNote) {
  return noteAuthor(note)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TM';
}

function noteRoleLabel(role: string) {
  return role.replace(/_/g, ' ');
}

function noteTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Row | null>(null);
  const [estimates, setEstimates] = useState<Row[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [err, setErr] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteError, setNoteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteSaving, setNoteSaving] = useState(false);
  const notesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr('');
        setNoteError('');
        setLoading(true);
        setNotesLoading(true);
        const res = await fetch(`/api/leads/${id}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed to load lead');
        if (!cancelled) {
          setLead(j.lead as Row);
          setEstimates((j.estimates as Row[]) || []);
        }
        const notesRes = await fetch(`/api/leads/${id}/notes`, { cache: 'no-store' });
        const notesJson = await notesRes.json();
        if (!cancelled) {
          if (notesRes.ok) {
            setNotes((notesJson.notes as LeadNote[]) || []);
          } else {
            setNoteError(notesJson.error || 'Failed to load notes.');
            setNotes([]);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Error');
          setLead(null);
          setEstimates([]);
          setNotes([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setNotesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [notes.length]);

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = noteDraft.trim();
    if (!body || noteSaving) {
      setNoteError('Note body is required.');
      return;
    }

    setNoteSaving(true);
    setNoteError('');
    try {
      const res = await fetch(`/api/leads/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to save note.');
      setNotes((current) => [...current, j.note as LeadNote]);
      setNoteDraft('');
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Failed to save note.');
    } finally {
      setNoteSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)] p-6">
        <div className="text-sm text-[var(--ops-muted)]">Loading lead...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)] p-6">
        <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
          {err || 'Lead not found'}
        </div>
        <Link href="/crm" className="mt-4 text-sm font-semibold text-[var(--ops-brand)] hover:underline">
          Back to CRM
        </Link>
      </div>
    );
  }

  const context = contextForLead(lead);
  const customerName = String(lead.customer_name || 'Cabin lead');

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
          <Link href="/crm" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ops-brand)] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Cabin CRM
          </Link>

          <AppPageHeader
            icon={Users}
            eyebrow="Cabin Lead Detail"
            title={customerName}
            description={String(lead.issue || 'Cabin project opportunity')}
            actions={
              <>
                <Link href="/crm" className={opsButtonClass('secondary')}>
                  Back to CRM
                </Link>
                <Link href="/ai-assistant" className={opsButtonClass('primary')}>
                  <Bot className="h-4 w-4" />
                  AI Growth Assistant
                </Link>
              </>
            }
          >
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="brand">{pipelineLabel(String(lead.status || 'new_lead'))}</StatusBadge>
              <StatusBadge tone="neutral">{sourceFromSlug(String(lead.source || ''))}</StatusBadge>
              <StatusBadge tone="success">Score {String(lead.ai_score || '-')}</StatusBadge>
            </div>
          </AppPageHeader>

          <KpiStrip className="xl:grid-cols-4">
            <StatCard label="Estimated Value" value={money(lead.estimated_value_cents)} meta={String(context.estimatedBudget || 'Budget not set')} tone="brand" icon={FileText} />
            <StatCard label="Next Follow-Up" value={formatDateLabel(String(lead.next_follow_up_at || ''))} meta="Sales discipline" tone="warning" icon={CalendarClock} />
            <StatCard label="Last Contacted" value={formatDateLabel(String(lead.last_contacted_at || ''))} meta="Recent touchpoint" tone="neutral" icon={Mail} />
            <StatCard label="Interest Level" value={String(context.cabinInterestLevel || '-')} meta={String(context.intendedUse || 'Use not set')} tone="success" icon={Users} />
          </KpiStrip>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <ConsolePanel title="Qualification Details" description="Site readiness and buyer/project fit for the next sales conversation.">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Lead type', context.leadType],
                    ['Company', context.company],
                    ['Project location', lead.location],
                    ['Intended use', context.intendedUse],
                    ['Owns land?', context.ownsLand],
                    ['Has site access?', context.hasSiteAccess],
                    ['Utilities available?', context.utilitiesAvailable],
                    ['Timeline', context.timeline],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">{String(label)}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--ops-text)]">{String(value || '-')}</p>
                    </div>
                  ))}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Notes and AI Summary" description="Use this for call prep, follow-up drafting, and handoff context.">
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">AI Summary</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ops-text)]">
                      {String(context.aiSummary || lead.ai_qualification || 'No AI summary yet.')}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">Internal Notes</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ops-text)]">
                      {String(context.notes || lead.description || 'No notes yet.')}
                    </p>
                  </div>
                </div>
              </ConsolePanel>

              <ConsolePanel title="Estimates" description="Estimates tied to this lead.">
                <DataTable
                  columns={[
                    { key: 'number', label: 'Estimate' },
                    { key: 'title', label: 'Title' },
                    { key: 'status', label: 'Status' },
                    { key: 'total', label: 'Total' },
                  ]}
                  minWidthClassName="min-w-[720px]"
                  className="border-0 shadow-none"
                >
                  {estimates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-[var(--ops-muted)]">
                        No estimates yet.
                      </td>
                    </tr>
                  ) : (
                    estimates.map((estimate) => (
                      <tr key={String(estimate.id)}>
                        <td className="px-5 py-4">
                          <Link href={`/estimates/${estimate.id}`} className="font-semibold text-[var(--ops-brand)] hover:underline">
                            {String(estimate.estimate_number)}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--ops-text)]">{String(estimate.title || '-')}</td>
                        <td className="px-5 py-4">
                          <StatusBadge tone="neutral">{String(estimate.status || '-')}</StatusBadge>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-[var(--ops-text)]">{money(estimate.total_amount_cents)}</td>
                      </tr>
                    ))
                  )}
                </DataTable>
              </ConsolePanel>
            </div>

            <div className="space-y-6 xl:sticky xl:top-6">
              <ConsolePanel title="Lead Notes" description="Team notes saved to this lead.">
                <div className="flex h-[560px] max-h-[calc(100vh-220px)] min-h-[420px] flex-col gap-4">
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-3">
                    {notesLoading ? (
                      <div className="flex h-full items-center justify-center text-sm text-[var(--ops-muted)]">
                        Loading notes...
                      </div>
                    ) : notes.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-[var(--ops-muted)]">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ops-border)] bg-[var(--ops-surface)] text-[var(--ops-brand)]">
                          <MessageSquareText className="h-5 w-5" />
                        </span>
                        No notes yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notes.map((note) => (
                          <div key={note.id} className="flex gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ops-brand-soft)] text-xs font-bold text-[var(--ops-brand)]">
                              {noteInitials(note)}
                            </div>
                            <div className="min-w-0 flex-1 rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface)] px-4 py-3">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <p className="text-sm font-semibold text-[var(--ops-text)]">{noteAuthor(note)}</p>
                                <span className="text-xs capitalize text-[var(--ops-muted)]">{noteRoleLabel(note.author_role)}</span>
                                {noteTimestamp(note.created_at) ? (
                                  <span className="text-xs text-[var(--ops-muted)]">{noteTimestamp(note.created_at)}</span>
                                ) : null}
                              </div>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--ops-text)]">{note.body}</p>
                            </div>
                          </div>
                        ))}
                        <div ref={notesEndRef} />
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleAddNote} className="space-y-3">
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      maxLength={4000}
                      rows={4}
                      placeholder={`Add a note for ${customerName}...`}
                      className="w-full resize-none rounded-[20px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm leading-6 text-[var(--ops-text)] outline-none transition focus:border-[var(--ops-brand)] focus:ring-2 focus:ring-[var(--ops-brand-soft)]"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className={`min-w-0 text-xs ${noteError ? 'text-[var(--ops-danger-ink)]' : 'text-[var(--ops-muted)]'}`}>
                        {noteError || `${noteDraft.trim().length.toLocaleString()} / 4,000`}
                      </p>
                      <button type="submit" disabled={noteSaving || !noteDraft.trim()} className={opsButtonClass('primary')}>
                        {noteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {noteSaving ? 'Saving' : 'Add note'}
                      </button>
                    </div>
                  </form>
                </div>
              </ConsolePanel>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
