'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  FileText,
  Files,
  Filter,
  FolderOpen,
  Inbox,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/ops';

type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

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

type TicketPanel = 'conversation' | 'solution' | 'files';

type TicketSolution = {
  status: 'ready' | 'draft' | 'pending';
  label: string;
  body: string;
  updatedAt: string | null;
  artifacts: TicketArtifact[];
};

type TicketArtifact = {
  id: string;
  label: string;
  href: string;
  kind: 'drive' | 'url' | 'local';
};

type CreateTicketDraft = {
  title: string;
  dueDate: string;
  priority: TicketPriority;
  description: string;
};

type EditTicketDraft = CreateTicketDraft & {
  bucketId: string;
};

const priorityClass: Record<string, string> = {
  low: 'border-[rgba(47,107,79,0.24)] bg-[rgba(47,107,79,0.08)] text-[#2f6b4f]',
  normal: 'border-[rgba(37,99,235,0.22)] bg-[rgba(37,99,235,0.08)] text-[#2563eb]',
  high: 'border-[rgba(242,106,31,0.26)] bg-[rgba(242,106,31,0.1)] text-[#bd4c12]',
  urgent: 'border-[rgba(190,57,82,0.25)] bg-[rgba(190,57,82,0.1)] text-[#be3952]',
};

const priorityOptions: Array<{ value: TicketPriority; label: string; description: string }> = [
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

function ticketToEditDraft(ticket: Ticket): EditTicketDraft {
  return {
    title: ticket.title,
    dueDate: ticket.due_date ? ticket.due_date.slice(0, 10) : '',
    priority: priorityOptions.some((option) => option.value === ticket.priority) ? (ticket.priority as TicketPriority) : 'normal',
    description: ticket.description || '',
    bucketId: ticket.bucket_id,
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

function isAgentComment(comment: TicketComment) {
  return comment.author_role === 'agent' || /agent/i.test(comment.author_name || '');
}

function isProgressOnlyAgentComment(body: string) {
  return /started working|is blocked|needs more information|hit an issue/i.test(body);
}

function artifactKind(href: string): TicketArtifact['kind'] {
  if (/drive\.google\.com|docs\.google\.com/i.test(href)) return 'drive';
  if (/^https?:\/\//i.test(href)) return 'url';
  return 'local';
}

function artifactLabel(value: string) {
  try {
    const url = new URL(value);
    if (/docs\.google\.com/i.test(url.hostname)) {
      if (url.pathname.startsWith('/spreadsheets/')) return 'Google Sheet';
      if (url.pathname.startsWith('/document/')) return 'Google Doc';
      if (url.pathname.startsWith('/presentation/')) return 'Google Slides';
      if (url.pathname.startsWith('/forms/')) return 'Google Form';
    }
    if (/drive\.google\.com/i.test(url.hostname)) {
      if (url.pathname.includes('/folders/')) return 'Google Drive folder';
      return 'Google Drive file';
    }
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.at(-1) || url.hostname;
  } catch {
    return value.split('/').filter(Boolean).at(-1) || value;
  }
}

function pushArtifact(artifacts: TicketArtifact[], seen: Set<string>, href: string, label?: string) {
  const cleaned = href.trim();
  if (!cleaned || seen.has(cleaned)) return;
  if (!/^(\/|https?:\/\/)/i.test(cleaned)) return;
  seen.add(cleaned);
  artifacts.push({
    id: cleaned,
    href: cleaned,
    label: label?.trim() || artifactLabel(cleaned),
    kind: artifactKind(cleaned),
  });
}

function extractArtifactLinks(body: string): TicketArtifact[] {
  const artifacts: TicketArtifact[] = [];
  const seen = new Set<string>();
  const markdownLinkPattern = /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g;
  const rawUrlPattern = /https?:\/\/[^\s)]+/g;

  for (const match of body.matchAll(markdownLinkPattern)) {
    pushArtifact(artifacts, seen, match[2], match[1]);
  }

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    const bulletValue = trimmed.startsWith('- ') ? trimmed.slice(2).trim() : '';
    if (bulletValue) {
      const markdownMatch = /^\[([^\]]+)]\((https?:\/\/[^)\s]+)\)$/.exec(bulletValue);
      if (markdownMatch) {
        pushArtifact(artifacts, seen, markdownMatch[2], markdownMatch[1]);
      } else {
        pushArtifact(artifacts, seen, bulletValue);
      }
    }

    for (const match of trimmed.matchAll(rawUrlPattern)) {
      pushArtifact(artifacts, seen, match[0]);
    }
  }
  return artifacts;
}

function ticketSolution(ticket: Ticket, comments: TicketComment[]): TicketSolution {
  const agentComments = comments.filter(isAgentComment);
  const latestAgentComment = agentComments.at(-1);
  const readyStatus = /ready for review|done/i.test(ticket.bucket_name || '');

  if (!latestAgentComment || (!readyStatus && isProgressOnlyAgentComment(latestAgentComment.body))) {
    return {
      status: 'pending',
      label: 'Summary pending',
      body: [
        `This ticket is currently ${ticket.bucket_name}.`,
        '',
        'Request summary',
        ticket.description?.trim() || ticket.title,
        '',
        `Urgency: ${priorityLabel(ticket.priority)}`,
        `Due date: ${formatDate(ticket.due_date)}`,
        '',
        'No final solution has been posted yet. When the work is complete, this report will show the final summary and any Google Drive deliverables linked to the ticket.',
      ].join('\n'),
      updatedAt: null,
      artifacts: [],
    };
  }

  return {
    status: readyStatus ? 'ready' : 'draft',
    label: readyStatus ? 'Solution ready' : 'Draft solution',
    body: latestAgentComment.body,
    updatedAt: latestAgentComment.created_at,
    artifacts: extractArtifactLinks(latestAgentComment.body),
  };
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
  const [editDraft, setEditDraft] = useState<EditTicketDraft | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  function startEditTicket(ticket: Ticket) {
    setEditDraft(ticketToEditDraft(ticket));
    setError('');
  }

  async function updateSelectedTicket() {
    if (!selectedTicket || !editDraft?.title.trim() || updating) return;
    setUpdating(true);
    setError('');
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editDraft.title,
          dueDate: editDraft.dueDate || null,
          priority: editDraft.priority,
          description: editDraft.description,
          bucketId: editDraft.bucketId,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Unable to update ticket.');
      setEditDraft(null);
      await Promise.all([loadBoard(true), loadDetail(selectedTicket.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update ticket.');
    } finally {
      setUpdating(false);
    }
  }

  async function deleteSelectedTicket() {
    if (!selectedTicket || deleting) return;
    const confirmed = window.confirm(`Delete "${selectedTicket.title}"? This also removes its comments.`);
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}`, { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Unable to delete ticket.');
      setSelectedTicketId(null);
      setDetail(null);
      setCommentBody('');
      setEditDraft(null);
      await loadBoard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete ticket.');
    } finally {
      setDeleting(false);
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
        <TicketWorkspaceModal
          ticket={selectedTicket}
          comments={detail?.comments ?? []}
          loading={detailLoading}
          body={commentBody}
          draft={editDraft}
          buckets={board.buckets}
          posting={posting}
          updating={updating}
          deleting={deleting}
          error={error}
          onBodyChange={setCommentBody}
          onDraftChange={setEditDraft}
          onClose={() => {
            setSelectedTicketId(null);
            setDetail(null);
            setCommentBody('');
            setEditDraft(null);
          }}
          onEdit={() => startEditTicket(selectedTicket)}
          onCancelEdit={() => {
            if (updating) return;
            setEditDraft(null);
          }}
          onUpdate={() => void updateSelectedTicket()}
          onDelete={() => void deleteSelectedTicket()}
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

function TicketWorkspaceModal({
  ticket,
  comments,
  loading,
  body,
  draft,
  buckets,
  posting,
  updating,
  deleting,
  error,
  onBodyChange,
  onDraftChange,
  onClose,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onPost,
}: {
  ticket: Ticket;
  comments: TicketComment[];
  loading: boolean;
  body: string;
  draft: EditTicketDraft | null;
  buckets: Bucket[];
  posting: boolean;
  updating: boolean;
  deleting: boolean;
  error: string;
  onBodyChange: (value: string) => void;
  onDraftChange: (draft: EditTicketDraft | null) => void;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onPost: () => void;
}) {
  const isEditing = Boolean(draft);
  const [panel, setPanel] = useState<TicketPanel>('conversation');
  const solution = useMemo(() => ticketSolution(ticket, comments), [comments, ticket]);
  const tabOptions: Array<{ id: TicketPanel; label: string; count?: number; icon: ReactNode }> = [
    { id: 'conversation', label: 'Conversation', count: count(ticket.comment_count), icon: <MessageSquareText className="h-4 w-4" /> },
    { id: 'solution', label: 'Solution', count: 1, icon: <FileText className="h-4 w-4" /> },
    { id: 'files', label: 'Files', count: solution.artifacts.length, icon: <FolderOpen className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/25 p-3 backdrop-blur-sm sm:p-5">
      <section className="flex h-[min(52rem,calc(100vh-1.5rem))] w-full max-w-[82rem] flex-col overflow-hidden rounded-lg border border-[var(--ops-border-strong)] bg-[var(--ops-surface-strong)] shadow-[0_26px_80px_-44px_rgba(8,18,35,0.72)] sm:h-[min(52rem,calc(100vh-2.5rem))]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--ops-border)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full border px-2 py-1 text-[10px] font-semibold uppercase', priorityClass[ticket.priority] ?? priorityClass.normal)}>
                {priorityLabel(ticket.priority)}
              </span>
              <span className="rounded-full border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--ops-muted)]">
                {ticket.bucket_name}
              </span>
            </div>
            <h2 className="mt-2 line-clamp-2 text-xl font-semibold leading-7 text-[var(--ops-text)] sm:text-2xl">{ticket.title}</h2>
            <p className="mt-1 text-sm text-[var(--ops-muted)]">Updated {formatDateTime(ticket.updated_at)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  disabled={updating}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--ops-border)] bg-white px-3 text-sm font-semibold text-[var(--ops-text)] hover:bg-[var(--ops-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onUpdate}
                  disabled={updating || !draft?.title.trim() || !draft?.bucketId}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2f6b4f] px-3 text-sm font-semibold text-white hover:bg-[#275a42] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                  <span className="hidden sm:inline">{updating ? 'Saving' : 'Save'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--ops-border)] bg-white px-3 text-sm font-semibold text-[var(--ops-text)] hover:bg-[var(--ops-surface-subtle)]"
              >
                <Edit3 className="h-4 w-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Delete ticket"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--ops-border)] text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
          <aside className="min-h-0 overflow-y-auto border-b border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-4 lg:border-b-0 lg:border-r sm:px-5">
            {draft ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  onUpdate();
                }}
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--ops-muted)]">Edit ticket</p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--ops-text)]">Ticket details</h3>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Status</span>
                  <select
                    value={draft.bucketId}
                    onChange={(event) => onDraftChange({ ...draft, bucketId: event.target.value })}
                    className="h-11 w-full rounded-lg border border-[var(--ops-border)] bg-white px-3 text-sm text-[var(--ops-text)] outline-none focus:border-[#2f6b4f] focus:ring-4 focus:ring-[rgba(47,107,79,0.14)]"
                  >
                    {buckets.map((bucket) => (
                      <option key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Name</span>
                  <input
                    value={draft.title}
                    onChange={(event) => onDraftChange({ ...draft, title: event.target.value.slice(0, 160) })}
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
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                    className="w-full resize-none rounded-lg border border-[var(--ops-border)] bg-white px-3 py-2 text-sm leading-6 text-[var(--ops-text)] outline-none focus:border-[#2f6b4f] focus:ring-4 focus:ring-[rgba(47,107,79,0.14)]"
                  />
                  <span className="mt-1 block text-xs text-[var(--ops-muted)]">{draft.description.trim().length}/4000</span>
                </label>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
              </form>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <DetailPill label="Due date" value={formatDate(ticket.due_date)} icon={<CalendarDays className="h-4 w-4" />} />
                  <DetailPill label="Comments" value={String(count(ticket.comment_count))} icon={<MessageSquareText className="h-4 w-4" />} />
                  <DetailPill label="Project" value={ticket.project_title || 'None'} icon={<CheckCircle2 className="h-4 w-4" />} />
                  <DetailPill label="Files" value="Coming soon" icon={<Files className="h-4 w-4" />} />
                </div>

                <section className="mt-4 rounded-lg border border-[var(--ops-border)] bg-white px-4 py-3">
                  <h3 className="text-sm font-semibold text-[var(--ops-text)]">Details</h3>
                  {ticket.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ops-muted)]">{ticket.description}</p>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--ops-muted)]">No details yet.</p>
                  )}
                </section>
              </>
            )}
          </aside>

          <section className="flex min-h-0 flex-1 flex-col bg-[var(--ops-surface-subtle)]">
            <div className="border-b border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--ops-text)]">
                    {panel === 'conversation' ? 'Ticket conversation' : panel === 'solution' ? 'Solution report' : 'Ticket files'}
                  </h3>
                  <p className="text-xs text-[var(--ops-muted)]">
                    {panel === 'conversation'
                      ? `${count(ticket.comment_count).toLocaleString()} admin/client updates`
                      : panel === 'solution'
                        ? solution.label
                        : solution.artifacts.length ? `${solution.artifacts.length.toLocaleString()} linked artifacts` : 'No linked files yet'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {tabOptions.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPanel(tab.id)}
                      className={cn(
                        'inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition',
                        panel === tab.id
                          ? 'border-[rgba(47,107,79,0.28)] bg-[rgba(47,107,79,0.1)] text-[#2f6b4f]'
                          : 'border-[var(--ops-border)] bg-white text-[var(--ops-muted)] hover:text-[var(--ops-text)]',
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.count ? (
                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-[var(--ops-muted)]">{tab.count}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--ops-muted)]" /> : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {loading ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-[var(--ops-border)] bg-white text-sm text-[var(--ops-muted)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading ticket
                </div>
              ) : panel === 'conversation' ? (
                comments.length === 0 ? (
                  <div className="flex h-full min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-[var(--ops-border-strong)] bg-white text-sm text-[var(--ops-muted)]">
                    No updates yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => {
                      const author = comment.author_name || comment.author_email || 'Team member';
                      const initials = author
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join('') || 'A';
                      const isStaff = comment.author_role === 'staff' || comment.author_role === 'admin' || comment.author_role === 'super_admin';
                      return (
                        <article key={comment.id} className={cn('flex gap-3', isStaff && 'justify-end')}>
                          {!isStaff ? (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2f6b4f] text-xs font-semibold text-white">
                              {initials}
                            </div>
                          ) : null}
                          <div className={cn('max-w-[min(42rem,92%)] rounded-lg border px-4 py-3 shadow-[var(--ops-shadow-soft)]', isStaff ? 'border-[rgba(47,107,79,0.22)] bg-white' : 'border-[var(--ops-border)] bg-white')}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-sm font-semibold text-[var(--ops-text)]">{author}</p>
                              <p className="text-xs text-[var(--ops-muted)]">{comment.author_role.replace('_', ' ')} · {formatDateTime(comment.created_at)}</p>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ops-muted)]">{comment.body}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )
              ) : panel === 'solution' ? (
                <SolutionPanel solution={solution} ticket={ticket} />
              ) : (
                <FilesPanel artifacts={solution.artifacts} />
              )}
            </div>

            {panel === 'conversation' ? (
            <div className="border-t border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 sm:px-5">
              <textarea
                value={body}
                onChange={(event) => onBodyChange(event.target.value.slice(0, 4000))}
                placeholder="Write an admin/client update"
                className="min-h-[6rem] w-full resize-none rounded-lg border border-[var(--ops-border)] bg-white px-3 py-2 text-sm text-[var(--ops-text)] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-100"
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
                  Add update
                </button>
              </div>
            </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}

function SolutionPanel({ solution, ticket }: { solution: TicketSolution; ticket: Ticket }) {
  return (
    <article className="rounded-lg border border-[var(--ops-border)] bg-white shadow-[var(--ops-shadow-soft)]">
      <div className="border-b border-[var(--ops-border)] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase',
                  solution.status === 'ready'
                    ? 'border-[rgba(47,107,79,0.24)] bg-[rgba(47,107,79,0.08)] text-[#2f6b4f]'
                    : solution.status === 'draft'
                      ? 'border-[rgba(242,106,31,0.26)] bg-[rgba(242,106,31,0.1)] text-[#bd4c12]'
                      : 'border-[rgba(37,99,235,0.22)] bg-[rgba(37,99,235,0.08)] text-[#2563eb]',
                )}
              >
                {solution.label}
              </span>
              <span className="rounded-full border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--ops-muted)]">
                {ticket.bucket_name}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-[var(--ops-text)]">Solution for {ticket.title}</h3>
            {solution.updatedAt ? <p className="mt-1 text-xs text-[var(--ops-muted)]">Updated {formatDateTime(solution.updatedAt)}</p> : null}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-4 py-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ops-text)]">{solution.body}</p>
        </div>

        {solution.artifacts.length ? (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-[var(--ops-text)]">Linked deliverables</h4>
            <p className="mt-1 text-xs text-[var(--ops-muted)]">These files support the written summary above.</p>
            <div className="mt-2 grid gap-2">
              {solution.artifacts.map((artifact) => (
                <ArtifactRow key={artifact.id} artifact={artifact} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FilesPanel({ artifacts }: { artifacts: TicketArtifact[] }) {
  if (artifacts.length === 0) {
    return (
      <div className="flex h-full min-h-[18rem] items-center justify-center rounded-lg border border-dashed border-[var(--ops-border-strong)] bg-white px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.08)] text-[#2563eb]">
            <FolderOpen className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-[var(--ops-text)]">No files linked yet</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
            Google Drive folders, Docs, Sheets, PDFs, and other deliverables will be listed here once they are attached to the ticket result.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {artifacts.map((artifact) => (
        <ArtifactRow key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: TicketArtifact }) {
  const isUrl = artifact.kind === 'drive' || artifact.kind === 'url';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ops-border)] bg-white px-3 py-3 shadow-[var(--ops-shadow-soft)]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] text-[var(--ops-muted)]">
          {artifact.kind === 'drive' ? <FolderOpen className="h-4 w-4" /> : <Files className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{artifact.label}</p>
          <p className="truncate text-xs text-[var(--ops-muted)]">
            {artifact.kind === 'drive' ? 'Google Drive link' : artifact.kind === 'url' ? 'External link' : artifact.href}
          </p>
        </div>
      </div>
      {isUrl ? (
        <a
          href={artifact.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ops-border)] bg-white px-3 text-sm font-semibold text-[var(--ops-text)] hover:bg-[var(--ops-surface-subtle)]"
        >
          Open
        </a>
      ) : (
        <span className="shrink-0 rounded-full bg-[var(--ops-surface-subtle)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--ops-muted)]">
          Local
        </span>
      )}
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
