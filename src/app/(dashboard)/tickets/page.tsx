'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Files,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { cn, formatDateLabel, formatDateTimeLabel } from '@/lib/ops';

type Bucket = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

type Ticket = {
  id: string;
  bucket_id: string;
  company_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  priority: TicketPriority;
  requester_email: string | null;
  source: string;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  bucket_name: string;
  bucket_color: string;
  project_title: string | null;
  project_status: string | null;
  comment_count: number | string;
  latest_comment_body: string | null;
  latest_comment_at: string | null;
  commented_by_current_user?: boolean | number;
};

type TicketComment = {
  id: string;
  ticket_id: string;
  company_id: string;
  author_user_id: string | null;
  author_role: string;
  author_name: string | null;
  author_email: string | null;
  body: string;
  created_at: string;
};

type BoardResponse = {
  buckets: Bucket[];
  tickets: Ticket[];
  currentUserEmail: string;
  error?: string;
};

type DetailResponse = {
  ticket?: Ticket;
  comments?: TicketComment[];
  currentUserEmail?: string;
  error?: string;
};

const priorityTone: Record<TicketPriority, string> = {
  low: 'border-slate-200 bg-slate-50 text-slate-600',
  normal: 'border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)] text-[var(--ops-brand-ink)]',
  high: 'border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] text-[var(--ops-warning-ink)]',
  urgent: 'border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] text-[var(--ops-danger-ink)]',
};

const tabClass =
  'inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors';

function commentCount(ticket: Ticket) {
  return Number(ticket.comment_count || 0);
}

function shortTicketId(id: string) {
  return `TCK-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

function parseDate(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function normalizeBool(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function hexToRgba(hex: string, alpha: number) {
  const fallback = '#2f6b4f';
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
  const raw = normalized.slice(1);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function TicketsPage() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'board' | 'mine' | 'all'>('board');
  const [bucketFilter, setBucketFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'board' | 'due_asc' | 'due_desc'>('board');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const loadBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tickets', { cache: 'no-store' });
      const json = (await response.json()) as BoardResponse;
      if (!response.ok) throw new Error(json.error || 'Could not load tickets.');
      setBuckets(json.buckets || []);
      setTickets(json.tickets || []);
      setCurrentUserEmail(json.currentUserEmail || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tickets.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadTicketDetail = useCallback(async (ticketId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, { cache: 'no-store' });
      const json = (await response.json()) as DetailResponse;
      if (!response.ok || !json.ticket) throw new Error(json.error || 'Could not load ticket.');
      setSelectedTicket(json.ticket);
      setComments(json.comments || []);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Could not load ticket.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadBoard(true);
      if (selectedTicketId) void loadTicketDetail(selectedTicketId);
    }, 30_000);
    const onFocus = () => {
      void loadBoard(true);
      if (selectedTicketId) void loadTicketDetail(selectedTicketId);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadBoard, loadTicketDetail, selectedTicketId]);

  function openTicket(ticket: Ticket) {
    setSelectedTicketId(ticket.id);
    setSelectedTicket(ticket);
    setComments([]);
    setCommentBody('');
    void loadTicketDetail(ticket.id);
  }

  function closeTicket() {
    setSelectedTicketId(null);
    setSelectedTicket(null);
    setComments([]);
    setDetailError(null);
    setCommentBody('');
  }

  async function postComment() {
    if (!selectedTicketId || !commentBody.trim()) return;
    setPostingComment(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/tickets/${selectedTicketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody }),
      });
      const json = (await response.json()) as DetailResponse;
      if (!response.ok || !json.ticket) throw new Error(json.error || 'Could not add comment.');
      setSelectedTicket(json.ticket);
      setComments(json.comments || []);
      setTickets((current) =>
        current.map((ticket) => (ticket.id === json.ticket?.id ? { ...ticket, ...json.ticket } : ticket)),
      );
      setCommentBody('');
      setNotice('Comment added.');
      window.setTimeout(() => setNotice(null), 2500);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Could not add comment.');
    } finally {
      setPostingComment(false);
    }
  }

  const filteredTickets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const userEmail = currentUserEmail.toLowerCase();
    const list = tickets.filter((ticket) => {
      if (bucketFilter !== 'all' && ticket.bucket_id !== bucketFilter) return false;
      if (tab === 'mine') {
        const requestedByUser = String(ticket.requester_email || '').toLowerCase() === userEmail;
        if (!requestedByUser && !normalizeBool(ticket.commented_by_current_user)) return false;
      }
      if (!needle) return true;
      return [
        ticket.title,
        ticket.description,
        ticket.bucket_name,
        ticket.project_title,
        ticket.requester_email,
        ticket.latest_comment_body,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    return [...list].sort((a, b) => {
      if (sortMode === 'due_asc') return parseDate(a.due_date) - parseDate(b.due_date);
      if (sortMode === 'due_desc') return parseDate(b.due_date) - parseDate(a.due_date);
      return Number(a.sort_order || 0) - Number(b.sort_order || 0) || b.updated_at.localeCompare(a.updated_at);
    });
  }, [bucketFilter, currentUserEmail, query, sortMode, tab, tickets]);

  const ticketsByBucket = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const bucket of buckets) map.set(bucket.id, []);
    for (const ticket of filteredTickets) {
      if (!map.has(ticket.bucket_id)) map.set(ticket.bucket_id, []);
      map.get(ticket.bucket_id)?.push(ticket);
    }
    return map;
  }, [buckets, filteredTickets]);

  const activeTicket = selectedTicket;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-hidden px-4 py-5 sm:px-6 xl:px-8">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1900px] flex-col rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface)] shadow-[var(--ops-shadow-soft)]">
          <header className="shrink-0 border-b border-[var(--ops-border)] px-4 py-4 lg:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                  WNY Automation Portal
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-[var(--ops-text)]">Tickets</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['board', 'mine', 'all'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={cn(
                      tabClass,
                      tab === item
                        ? 'bg-[var(--ops-brand)] text-white'
                        : 'border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] text-[var(--ops-muted-strong)] hover:bg-[var(--ops-surface-subtle)]',
                    )}
                  >
                    {item === 'board' ? 'Board' : item === 'mine' ? 'My Tickets' : 'All Tickets'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3 text-sm">
                <Search className="h-4 w-4 shrink-0 text-[var(--ops-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tickets"
                  className="min-w-0 flex-1 bg-transparent text-[var(--ops-text)] outline-none placeholder:text-[var(--ops-muted)]"
                />
              </label>
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3 text-sm text-[var(--ops-muted-strong)]">
                <SlidersHorizontal className="h-4 w-4 text-[var(--ops-muted)]" />
                <select
                  value={bucketFilter}
                  onChange={(event) => setBucketFilter(event.target.value)}
                  className="bg-transparent pr-6 text-sm font-medium text-[var(--ops-text)] outline-none"
                >
                  <option value="all">All statuses</option>
                  {buckets.map((bucket) => (
                    <option key={bucket.id} value={bucket.id}>
                      {bucket.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3 text-sm text-[var(--ops-muted-strong)]">
                <CalendarClock className="h-4 w-4 text-[var(--ops-muted)]" />
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
                  className="bg-transparent pr-6 text-sm font-medium text-[var(--ops-text)] outline-none"
                >
                  <option value="board">Board order</option>
                  <option value="due_asc">Due date asc</option>
                  <option value="due_desc">Due date desc</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => void loadBoard()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3 text-sm font-semibold text-[var(--ops-muted-strong)] hover:bg-[var(--ops-surface-subtle)]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
            </div>
          </header>

          {error ? (
            <div className="mx-4 mt-4 rounded-lg border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <section className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
            <div className="flex h-full min-w-max gap-3">
              {buckets.map((bucket) => (
                <TicketColumn
                  key={bucket.id}
                  bucket={bucket}
                  tickets={ticketsByBucket.get(bucket.id) || []}
                  loading={loading}
                  onOpenTicket={openTicket}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      {notice ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--ops-success-soft-border)] bg-[var(--ops-success-soft)] px-4 py-2 text-sm font-semibold text-[var(--ops-success-ink)] shadow-[var(--ops-shadow-soft)]">
          {notice}
        </div>
      ) : null}

      {activeTicket ? (
        <TicketDrawer
          ticket={activeTicket}
          comments={comments}
          loading={detailLoading}
          error={detailError}
          commentBody={commentBody}
          postingComment={postingComment}
          onClose={closeTicket}
          onCommentBodyChange={setCommentBody}
          onPostComment={() => void postComment()}
        />
      ) : null}
    </div>
  );
}

function TicketColumn({
  bucket,
  tickets,
  loading,
  onOpenTicket,
}: {
  bucket: Bucket;
  tickets: Ticket[];
  loading: boolean;
  onOpenTicket: (ticket: Ticket) => void;
}) {
  return (
    <section className="flex h-full w-[19rem] shrink-0 flex-col rounded-lg border border-[var(--ops-border)] bg-[var(--ops-bg)]">
      <div className="border-b border-[var(--ops-border)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: bucket.color || '#2f6b4f' }} />
            <h2 className="truncate text-sm font-semibold text-[var(--ops-text)]">{bucket.name}</h2>
          </div>
          <span className="rounded-full bg-[var(--ops-surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--ops-muted)]">
            {tickets.length}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {loading && tickets.length === 0 ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-lg bg-[var(--ops-surface-subtle)]" />
          ))
        ) : tickets.length ? (
          tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} color={bucket.color} onOpen={() => onOpenTicket(ticket)} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--ops-border)] bg-[var(--ops-surface)] px-4 py-8 text-center text-sm text-[var(--ops-muted)]">
            No tickets
          </div>
        )}
      </div>
    </section>
  );
}

function TicketCard({ ticket, color, onOpen }: { ticket: Ticket; color: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface)] p-3 text-left shadow-[var(--ops-shadow-soft)] transition hover:border-[var(--ops-border-strong)] hover:bg-white"
      style={{ borderTopColor: color || '#2f6b4f' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold text-[var(--ops-muted)]">{shortTicketId(ticket.id)}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--ops-text)]">{ticket.title}</h3>
        </div>
        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize', priorityTone[ticket.priority])}>
          {ticket.priority}
        </span>
      </div>
      {ticket.description ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--ops-muted-strong)]">{ticket.description}</p>
      ) : null}
      {ticket.latest_comment_body ? (
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-xs leading-5 text-[var(--ops-muted-strong)]"
          style={{ borderColor: hexToRgba(color, 0.28), backgroundColor: hexToRgba(color, 0.08) }}
        >
          {ticket.latest_comment_body}
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--ops-muted)]">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          {ticket.due_date ? formatDateLabel(ticket.due_date) : 'No due date'}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <MessageSquareText className="h-3.5 w-3.5" />
          {commentCount(ticket)}
        </span>
      </div>
    </button>
  );
}

function TicketDrawer({
  ticket,
  comments,
  loading,
  error,
  commentBody,
  postingComment,
  onClose,
  onCommentBodyChange,
  onPostComment,
}: {
  ticket: Ticket;
  comments: TicketComment[];
  loading: boolean;
  error: string | null;
  commentBody: string;
  postingComment: boolean;
  onClose: () => void;
  onCommentBodyChange: (value: string) => void;
  onPostComment: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 lg:bg-transparent">
      <aside className="absolute right-0 top-0 flex h-full w-full flex-col border-l border-[var(--ops-border)] bg-[var(--ops-surface)] shadow-2xl lg:max-w-[28rem]">
        <div className="shrink-0 border-b border-[var(--ops-border)] px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-[var(--ops-muted)]">{shortTicketId(ticket.id)}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: ticket.bucket_color || '#2f6b4f' }}>
                  {ticket.bucket_name}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-6 text-[var(--ops-text)]">{ticket.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)] hover:text-[var(--ops-text)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <MetaTile label="Priority" value={ticket.priority} tone={priorityTone[ticket.priority]} />
            <MetaTile label="Due date" value={ticket.due_date ? formatDateLabel(ticket.due_date) : 'No due date'} />
            <MetaTile label="Project" value={ticket.project_title || 'No project'} />
            <MetaTile label="Updated" value={formatDateTimeLabel(ticket.updated_at)} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="border-b border-[var(--ops-border)] px-4 py-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ops-text)]">
              <CheckCircle2 className="h-4 w-4 text-[var(--ops-brand)]" />
              Details
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ops-muted-strong)]">
              {ticket.description || 'No details added.'}
            </p>
          </section>

          <section className="border-b border-[var(--ops-border)] px-4 py-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--ops-text)]">
              <Files className="h-4 w-4 text-[var(--ops-brand)]" />
              Files
            </div>
            <div className="rounded-lg border border-dashed border-[var(--ops-border)] bg-[var(--ops-bg)] px-4 py-5 text-center text-sm text-[var(--ops-muted)]">
              No files
            </div>
          </section>

          <section className="px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ops-text)]">
                <MessageSquareText className="h-4 w-4 text-[var(--ops-brand)]" />
                Conversation
              </div>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--ops-muted)]" /> : null}
            </div>
            {error ? (
              <div className="mb-3 rounded-lg border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-3 py-2 text-sm text-[var(--ops-danger-ink)]">
                {error}
              </div>
            ) : null}
            <div className="space-y-3">
              {comments.length ? (
                comments.map((comment) => (
                  <article key={comment.id} className="rounded-lg border border-[var(--ops-border)] bg-white px-3 py-3">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ops-text)]">{comment.body}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ops-muted)]">
                      <span className="font-semibold text-[var(--ops-muted-strong)]">
                        {comment.author_name || comment.author_email || 'WNY Automation'}
                      </span>
                      <span>{formatDateTimeLabel(comment.created_at)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--ops-border)] bg-[var(--ops-bg)] px-4 py-6 text-center text-sm text-[var(--ops-muted)]">
                  No comments
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-[var(--ops-border)] bg-[var(--ops-surface)] p-4">
          <textarea
            value={commentBody}
            onChange={(event) => onCommentBodyChange(event.target.value)}
            placeholder="Write a comment..."
            maxLength={4000}
            className="min-h-24 w-full resize-none rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3 py-3 text-sm text-[var(--ops-text)] outline-none placeholder:text-[var(--ops-muted)] focus:border-[var(--ops-border-strong)]"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--ops-muted)]">{commentBody.trim().length.toLocaleString()} / 4,000</span>
            <button
              type="button"
              onClick={onPostComment}
              disabled={postingComment || !commentBody.trim()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--ops-brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--ops-brand-strong)] disabled:pointer-events-none disabled:opacity-50"
            >
              {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MetaTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-bg)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ops-muted)]">{label}</p>
      {tone ? (
        <span className={cn('mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-xs font-semibold capitalize', tone)}>
          {value}
        </span>
      ) : (
        <p className="mt-1 truncate text-sm font-semibold text-[var(--ops-text)]">{value}</p>
      )}
    </div>
  );
}
