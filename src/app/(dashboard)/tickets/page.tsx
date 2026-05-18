'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Files,
  Filter,
  Inbox,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { cn } from '@/lib/ops';

type Bucket = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

type Ticket = {
  id: string;
  company_id: string;
  bucket_id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent' | string;
  due_date: string | null;
  requester_email: string | null;
  project_title: string | null;
  project_status: string | null;
  bucket_name: string;
  bucket_color: string;
  comment_count: number | string;
  latest_comment_body: string | null;
  latest_comment_at: string | null;
  commented_by_current_user?: number | string;
  created_at: string;
  updated_at: string;
};

type TicketComment = {
  id: string;
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
};

type TicketDetailResponse = {
  ticket: Ticket;
  comments: TicketComment[];
};

type CreateTicketDraft = {
  title: string;
  dueDate: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  description: string;
};

const priorityClass: Record<string, string> = {
  low: 'border-[rgba(47,107,79,0.24)] bg-[rgba(47,107,79,0.08)] text-[#2f6b4f]',
  normal: 'border-[rgba(37,99,235,0.22)] bg-[rgba(37,99,235,0.08)] text-[#2563eb]',
  high: 'border-[rgba(242,106,31,0.26)] bg-[rgba(242,106,31,0.1)] text-[#bd4c12]',
  urgent: 'border-[rgba(190,57,82,0.25)] bg-[rgba(190,57,82,0.1)] text-[#be3952]',
};

const priorityOptions: Array<{ value: CreateTicketDraft['priority']; label: string; description: string }> = [
  { value: 'low', label: 'Low', description: 'Nice to have' },
  { value: 'normal', label: 'Normal', description: 'Standard work' },
  { value: 'high', label: 'High', description: 'Needs focus' },
  { value: 'urgent', label: 'Urgent', description: 'Time sensitive' },
];

function emptyTicketDraft(): CreateTicketDraft {
  return {
    title: '',
    dueDate: '',
    priority: 'normal',
    description: '',
  };
}

function count(value: unknown) {
  return Number(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function priorityLabel(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : 'Normal';
}

export default function TicketsPage() {
  const [board, setBoard] = useState<BoardResponse>({ buckets: [], tickets: [], currentUserEmail: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'board' | 'mine' | 'all'>('board');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'board' | 'due'>('board');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateTicketDraft>(() => emptyTicketDraft());
  const [creating, setCreating] = useState(false);

  const loadBoard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/tickets', { cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Unable to load tickets.');
      setBoard(json as BoardResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tickets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadDetail = useCallback(async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, { cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Unable to load ticket.');
      setDetail(json as TicketDetailResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ticket.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const interval = window.setInterval(() => loadBoard(true), 30000);
    const onFocus = () => loadBoard(true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadBoard]);

  const selectedTicket = detail?.ticket ?? board.tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;

  const visibleTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mineEmail = board.currentUserEmail.toLowerCase();
    const filtered = board.tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.bucket_id !== statusFilter) return false;
      if (activeTab === 'mine') {
        const requestedByMe = String(ticket.requester_email || '').toLowerCase() === mineEmail;
        if (!requestedByMe && count(ticket.commented_by_current_user) === 0) return false;
      }
      if (!q) return true;
      return [
        ticket.title,
        ticket.description,
        ticket.project_title,
        ticket.requester_email,
        ticket.latest_comment_body,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
    if (sortMode === 'due') {
      return [...filtered].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    }
    return filtered;
  }, [activeTab, board.currentUserEmail, board.tickets, query, sortMode, statusFilter]);

  async function postComment() {
    if (!selectedTicket || !commentBody.trim()) return;
    setPosting(true);
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Unable to post comment.');
      setCommentBody('');
      await Promise.all([loadDetail(selectedTicket.id), loadBoard(true)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setPosting(false);
    }
  }

  async function createNewTicket() {
    if (!createDraft.title.trim() || creating) return;
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createDraft.title,
          dueDate: createDraft.dueDate || null,
          priority: createDraft.priority,
          description: createDraft.description,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Unable to create ticket.');
      const ticket = json.ticket as Ticket | undefined;
      setCreateOpen(false);
      setCreateDraft(emptyTicketDraft());
      setActiveTab('board');
      setStatusFilter('all');
      await loadBoard(true);
      if (ticket?.id) await loadDetail(ticket.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create ticket.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-5 xl:px-6">
        <div className="mx-auto flex h-full w-full max-w-[1800px] flex-col gap-3">
          <header className="rounded-lg border border-[var(--ops-border-strong)] bg-[var(--ops-surface-strong)] px-4 py-3 shadow-[var(--ops-shadow-soft)]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(242,106,31,0.22)] bg-[rgba(242,106,31,0.08)] text-[#f26a1f]">
                  <Inbox className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--ops-muted)]">Client tickets</p>
                  <h1 className="text-[1.55rem] font-semibold text-[var(--ops-text)]">Tickets</h1>
                  <p className="text-sm text-[var(--ops-muted)]">Track admin-created work and keep the conversation in one shared thread.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2f6b4f] px-3 py-2 text-sm font-semibold text-white shadow-[var(--ops-shadow-soft)] transition hover:bg-[#275a42]"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Create Ticket
                </button>
                {(['board', 'mine', 'all'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                      activeTab === tab
                        ? 'bg-[#f26a1f] text-white'
                        : 'border border-[var(--ops-border)] bg-[var(--ops-surface-elevated)] text-[var(--ops-muted)] hover:text-[var(--ops-text)]',
                    )}
                  >
                    {tab === 'board' ? 'Board' : tab === 'mine' ? 'My Tickets' : 'All Tickets'}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <section className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3 py-3 shadow-[var(--ops-shadow-soft)]">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--ops-border)] bg-white px-3 py-2 text-sm text-[var(--ops-muted)]">
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tickets"
                  className="min-w-0 flex-1 bg-transparent text-[var(--ops-text)] outline-none placeholder:text-[var(--ops-muted)]"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--ops-border)] bg-white px-3 py-2 text-sm text-[var(--ops-muted)]">
                <Filter className="h-4 w-4" aria-hidden />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="bg-transparent text-[var(--ops-text)] outline-none"
                >
                  <option value="all">All statuses</option>
                  {board.buckets.map((bucket) => (
                    <option key={bucket.id} value={bucket.id}>{bucket.name}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setSortMode((mode) => (mode === 'board' ? 'due' : 'board'))}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--ops-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ops-text)]"
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                {sortMode === 'due' ? 'Sort: Due Date' : 'Sort: Board'}
              </button>
              <button
                type="button"
                onClick={() => loadBoard(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--ops-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ops-text)]"
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden />
                Refresh
              </button>
            </div>
            {error ? <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          </section>

          <section className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden pb-2">
            {loading ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] text-sm text-[var(--ops-muted)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading tickets
              </div>
            ) : (
              <div className="flex h-full min-w-max gap-3">
                {board.buckets.map((bucket) => {
                  const cards = visibleTickets.filter((ticket) => ticket.bucket_id === bucket.id);
                  return (
                    <div key={bucket.id} className="flex h-full w-[19rem] flex-col rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)]">
                      <div className="flex items-center justify-between gap-3 border-b border-[var(--ops-border)] px-3 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bucket.color }} />
                          <h2 className="truncate text-sm font-semibold text-[var(--ops-text)]">{bucket.name}</h2>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[var(--ops-muted)]">{cards.length}</span>
                      </div>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                        {cards.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-[var(--ops-border-strong)] bg-white px-3 py-6 text-center text-sm text-[var(--ops-muted)]">No tickets</div>
                        ) : cards.map((ticket) => (
                          <button
                            key={ticket.id}
                            type="button"
                            onClick={() => loadDetail(ticket.id)}
                            className="w-full rounded-lg border border-[var(--ops-border)] bg-white p-3 text-left shadow-[var(--ops-shadow-soft)] transition hover:border-[var(--ops-border-strong)]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ops-text)]">{ticket.title}</h3>
                              <span className={cn('shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase', priorityClass[ticket.priority] ?? priorityClass.normal)}>
                                {priorityLabel(ticket.priority)}
                              </span>
                            </div>
                            {ticket.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--ops-muted)]">{ticket.description}</p> : null}
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ops-muted)]">
                              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDate(ticket.due_date)}</span>
                              <span className="inline-flex items-center gap-1"><MessageSquareText className="h-3.5 w-3.5" />{count(ticket.comment_count)}</span>
                            </div>
                            {ticket.project_title ? <div className="mt-2 truncate text-xs font-medium text-[#2563eb]">{ticket.project_title}</div> : null}
                            {ticket.latest_comment_body ? (
                              <div className="mt-2 rounded-lg bg-[var(--ops-surface-subtle)] px-2.5 py-2 text-xs leading-5 text-[var(--ops-muted)]">
                                {ticket.latest_comment_body}
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {selectedTicket ? (
        <TicketDrawer
          ticket={selectedTicket}
          comments={detail?.comments ?? []}
          loading={detailLoading}
          body={commentBody}
          posting={posting}
          onBodyChange={setCommentBody}
          onClose={() => {
            setSelectedTicketId(null);
            setDetail(null);
            setCommentBody('');
          }}
          onPost={postComment}
        />
      ) : null}

      {createOpen ? (
        <CreateTicketDrawer
          draft={createDraft}
          creating={creating}
          error={error}
          onDraftChange={setCreateDraft}
          onClose={() => {
            if (creating) return;
            setCreateOpen(false);
            setCreateDraft(emptyTicketDraft());
          }}
          onCreate={() => void createNewTicket()}
        />
      ) : null}
    </div>
  );
}

function TicketDrawer({
  ticket,
  comments,
  loading,
  body,
  posting,
  onBodyChange,
  onClose,
  onPost,
}: {
  ticket: Ticket;
  comments: TicketComment[];
  loading: boolean;
  body: string;
  posting: boolean;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onPost: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20 backdrop-blur-sm">
      <aside className="flex h-full w-full flex-col border-l border-[var(--ops-border-strong)] bg-[var(--ops-surface-strong)] shadow-[0_18px_44px_-28px_rgba(8,18,35,0.5)] sm:max-w-[32rem]">
        <div className="border-b border-[var(--ops-border)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full border px-2 py-1 text-[10px] font-semibold uppercase', priorityClass[ticket.priority] ?? priorityClass.normal)}>
                  {priorityLabel(ticket.priority)}
                </span>
                <span className="rounded-full border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--ops-muted)]">
                  {ticket.bucket_name}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-semibold leading-7 text-[var(--ops-text)]">{ticket.title}</h2>
              <p className="mt-1 text-sm text-[var(--ops-muted)]">Updated {formatDateTime(ticket.updated_at)}</p>
            </div>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--ops-border)] text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <DetailPill label="Due date" value={formatDate(ticket.due_date)} icon={<CalendarDays className="h-4 w-4" />} />
            <DetailPill label="Comments" value={String(count(ticket.comment_count))} icon={<MessageSquareText className="h-4 w-4" />} />
            <DetailPill label="Project" value={ticket.project_title || 'None'} icon={<CheckCircle2 className="h-4 w-4" />} />
            <DetailPill label="Files" value="Coming soon" icon={<Files className="h-4 w-4" />} />
          </div>

          {ticket.description ? (
            <section className="mt-4 rounded-lg border border-[var(--ops-border)] bg-white px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--ops-text)]">Details</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ops-muted)]">{ticket.description}</p>
            </section>
          ) : null}

          <section className="mt-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--ops-text)]">Conversation</h3>
            {loading ? (
              <div className="rounded-lg border border-[var(--ops-border)] bg-white px-4 py-6 text-center text-sm text-[var(--ops-muted)]">
                <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                Loading conversation
              </div>
            ) : comments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--ops-border-strong)] bg-white px-4 py-6 text-center text-sm text-[var(--ops-muted)]">
                No comments yet
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-[var(--ops-border)] bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{comment.author_name || comment.author_email || 'Team member'}</p>
                        <p className="text-xs text-[var(--ops-muted)]">{comment.author_role.replace('_', ' ')} · {formatDateTime(comment.created_at)}</p>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ops-muted)]">{comment.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-[var(--ops-border)] px-5 py-4">
          <textarea
            value={body}
            onChange={(event) => onBodyChange(event.target.value.slice(0, 4000))}
            placeholder="Write a comment"
            className="min-h-[7rem] w-full rounded-lg border border-[var(--ops-border)] bg-white px-3 py-2 text-sm text-[var(--ops-text)] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-100"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--ops-muted)]">{body.length}/4000</span>
            <button
              type="button"
              onClick={onPost}
              disabled={posting || !body.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CreateTicketDrawer({
  draft,
  creating,
  error,
  onDraftChange,
  onClose,
  onCreate,
}: {
  draft: CreateTicketDraft;
  creating: boolean;
  error: string;
  onDraftChange: (draft: CreateTicketDraft) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/20 backdrop-blur-sm">
      <aside className="flex h-full w-full flex-col border-l border-[var(--ops-border-strong)] bg-[var(--ops-surface-strong)] shadow-[0_18px_44px_-28px_rgba(8,18,35,0.5)] sm:max-w-[32rem]">
        <div className="border-b border-[var(--ops-border)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--ops-muted)]">New ticket</p>
              <h2 className="mt-1 text-xl font-semibold leading-7 text-[var(--ops-text)]">Create Ticket</h2>
              <p className="mt-1 text-sm text-[var(--ops-muted)]">Capture the client request and place it in Inbox.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--ops-border)] text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate();
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Name</span>
                <input
                  value={draft.title}
                  onChange={(event) => onDraftChange({ ...draft, title: event.target.value.slice(0, 160) })}
                  placeholder="Example: Update homepage hero copy"
                  className="h-11 w-full rounded-lg border border-[var(--ops-border)] bg-white px-3 text-sm text-[var(--ops-text)] outline-none focus:border-[#2f6b4f] focus:ring-4 focus:ring-[rgba(47,107,79,0.14)]"
                />
                <span className="mt-1 block text-xs text-[var(--ops-muted)]">{draft.title.trim().length}/160</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Date Needed Done By</span>
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => onDraftChange({ ...draft, dueDate: event.target.value })}
                  className="h-11 w-full rounded-lg border border-[var(--ops-border)] bg-white px-3 text-sm text-[var(--ops-text)] outline-none focus:border-[#2f6b4f] focus:ring-4 focus:ring-[rgba(47,107,79,0.14)]"
                />
              </label>

              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--ops-text)]">Urgency</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {priorityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onDraftChange({ ...draft, priority: option.value })}
                      className={cn(
                        'rounded-lg border px-3 py-3 text-left transition',
                        draft.priority === option.value
                          ? priorityClass[option.value]
                          : 'border-[var(--ops-border)] bg-white text-[var(--ops-text)] hover:bg-[var(--ops-surface-subtle)]',
                      )}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs opacity-80">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Description</span>
                <textarea
                  value={draft.description}
                  onChange={(event) => onDraftChange({ ...draft, description: event.target.value.slice(0, 4000) })}
                  rows={8}
                  placeholder="What needs to be done? Include links, client context, acceptance notes, or any constraints."
                  className="w-full resize-none rounded-lg border border-[var(--ops-border)] bg-white px-3 py-2 text-sm leading-6 text-[var(--ops-text)] outline-none focus:border-[#2f6b4f] focus:ring-4 focus:ring-[rgba(47,107,79,0.14)]"
                />
                <span className="mt-1 block text-xs text-[var(--ops-muted)]">{draft.description.trim().length}/4000</span>
              </label>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-[var(--ops-border)] px-5 py-4">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={creating}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--ops-border)] bg-white px-4 text-sm font-semibold text-[var(--ops-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !draft.title.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2f6b4f] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creating ? 'Creating' : 'Create ticket'}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}

function DetailPill({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--ops-border)] bg-white px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--ops-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-[var(--ops-text)]">{value}</div>
    </div>
  );
}
