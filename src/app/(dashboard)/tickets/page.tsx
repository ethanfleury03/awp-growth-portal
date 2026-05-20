'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Ticket,
} from 'lucide-react';
import {
  AppPageHeader,
  ConsolePanel,
  DataTable,
  DetailDrawer,
  EmptyState,
  KpiStrip,
  OpsButton,
  OpsInput,
  OpsSelect,
  OpsTextarea,
  SearchField,
  SegmentedFilterBar,
  StatCard,
  StatusBadge,
  TimelineList,
} from '@/components/ops/ui';
import { roleAtLeast, type SessionUser } from '@/lib/auth/types';
import { formatDateTimeLabel, humanizeToken } from '@/lib/ops';

type TicketStatus = 'open' | 'in_progress' | 'waiting_on_client' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
type TicketCategory = 'general' | 'request' | 'bug' | 'access' | 'billing' | 'other';

type TicketRow = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  created_by_name: string | null;
  created_by_email: string | null;
  notification_error: string | null;
  last_activity_at: string;
  created_at: string;
  resolved_at: string | null;
  comment_count?: number;
};

type TicketComment = {
  id: string;
  body: string;
  author_name: string | null;
  author_email: string | null;
  author_role: string;
  created_at: string;
};

type TicketDetail = {
  ticket: TicketRow;
  comments: TicketComment[];
};

type TicketStats = Record<TicketStatus | 'total', number>;

const statusOptions: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_on_client', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const workflowStatusOptions: { value: TicketStatus; label: string }[] = statusOptions.filter(
  (option): option is { value: TicketStatus; label: string } => option.value !== 'all',
);

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const categoryOptions: { value: TicketCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'request', label: 'Request' },
  { value: 'bug', label: 'Issue' },
  { value: 'access', label: 'Access' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Other' },
];

const emptyStats: TicketStats = {
  total: 0,
  open: 0,
  in_progress: 0,
  waiting_on_client: 0,
  resolved: 0,
  closed: 0,
};

const emptyForm = {
  title: '',
  description: '',
  category: 'general' as TicketCategory,
  priority: 'normal' as TicketPriority,
};

function statusTone(status: string) {
  if (status === 'resolved' || status === 'closed') return 'success' as const;
  if (status === 'waiting_on_client') return 'warning' as const;
  if (status === 'in_progress') return 'sky' as const;
  return 'brand' as const;
}

function priorityTone(priority: string) {
  if (priority === 'urgent') return 'danger' as const;
  if (priority === 'high') return 'warning' as const;
  if (priority === 'low') return 'muted' as const;
  return 'neutral' as const;
}

function requester(ticket: TicketRow) {
  return ticket.created_by_name || ticket.created_by_email || 'Client user';
}

export default function TicketsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [stats, setStats] = useState<TicketStats>(emptyStats);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [drawerMode, setDrawerMode] = useState<'create' | 'detail' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [comment, setComment] = useState('');

  const canManage = user ? roleAtLeast(user.role, 'staff') : false;

  const fetchMe = useCallback(async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated && data.user) setUser(data.user);
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/tickets?${params}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unable to load tickets.');
      setTickets(data.tickets || []);
      setStats({ ...emptyStats, ...(data.stats || {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/tickets/${id}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unable to load ticket.');
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load ticket.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const visibleTickets = useMemo(() => tickets, [tickets]);

  const openCreate = () => {
    setForm(emptyForm);
    setDetail(null);
    setSelectedId(null);
    setDrawerMode('create');
  };

  const openDetail = (ticket: TicketRow) => {
    setSelectedId(ticket.id);
    setDrawerMode('detail');
    void fetchDetail(ticket.id);
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setSelectedId(null);
    setDetail(null);
    setComment('');
    setForm(emptyForm);
  };

  const createNewTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unable to create ticket.');
      setForm(emptyForm);
      setDrawerMode('detail');
      setSelectedId(data.ticket.id);
      await fetchTickets();
      await fetchDetail(data.ticket.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId || !comment.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/tickets/${selectedId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unable to add comment.');
      setComment('');
      await fetchTickets();
      await fetchDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const patchTicket = async (patch: Partial<Pick<TicketRow, 'status' | 'priority' | 'category'>>) => {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/tickets/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unable to update ticket.');
      await fetchTickets();
      await fetchDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTicket = detail?.ticket;
  const activeTickets = stats.open + stats.in_progress + stats.waiting_on_client;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
          <AppPageHeader
            icon={Ticket}
            eyebrow="Portal / Tickets"
            title="Tickets"
            description="Create requests, track status, and keep the thread in one place."
            actions={
              <>
                <SearchField
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tickets..."
                  className="min-w-[min(360px,100%)]"
                />
                <OpsButton type="button" onClick={openCreate} variant="primary">
                  <Plus className="h-4 w-4" />
                  New ticket
                </OpsButton>
              </>
            }
          />

          {error ? (
            <div className="rounded-xl border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <KpiStrip>
            <StatCard label="Total" value={loading ? '...' : stats.total} meta={`${activeTickets} active`} tone="brand" icon={Ticket} />
            <StatCard label="Open" value={loading ? '...' : stats.open} meta="New or reopened" tone="brand" icon={MessageSquare} />
            <StatCard label="In progress" value={loading ? '...' : stats.in_progress} meta="Being handled" tone="sky" icon={Clock3} />
            <StatCard label="Resolved" value={loading ? '...' : stats.resolved + stats.closed} meta="Done or archived" tone="success" icon={CheckCircle2} />
          </KpiStrip>

          <ConsolePanel
            title="Ticket queue"
            description="Open a row to view the thread and status."
            action={
              <SegmentedFilterBar
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as TicketStatus | 'all')}
                options={statusOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  count: option.value === 'all' ? stats.total : stats[option.value],
                }))}
              />
            }
            contentClassName="p-0"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3 px-5 py-16 text-sm text-[var(--ops-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tickets...
              </div>
            ) : visibleTickets.length === 0 ? (
              <div className="px-5 py-6">
                <EmptyState
                  icon={Ticket}
                  title="No tickets yet"
                  description="Use a ticket when something needs attention or follow-up."
                  action={
                    <OpsButton type="button" onClick={openCreate} variant="primary">
                      <Plus className="h-4 w-4" />
                      New ticket
                    </OpsButton>
                  }
                />
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'ticket', label: 'Ticket' },
                  { key: 'requester', label: 'Requester' },
                  { key: 'activity', label: 'Activity' },
                  { key: 'priority', label: 'Priority' },
                  { key: 'status', label: 'Status' },
                ]}
                footer={`Showing ${visibleTickets.length} of ${stats.total} tickets`}
                minWidthClassName="min-w-[980px]"
                className="border-0 shadow-none"
              >
                {visibleTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => openDetail(ticket)}
                    className="cursor-pointer transition-colors hover:bg-[var(--ops-surface-subtle)]"
                  >
                    <td className="px-5 py-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="max-w-[560px] truncate text-sm font-semibold text-[var(--ops-text)]">
                            {ticket.title}
                          </p>
                          {ticket.notification_error ? (
                            <StatusBadge tone="warning">
                              <AlertTriangle className="h-3 w-3" />
                              Notify
                            </StatusBadge>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-1 max-w-[680px] text-xs text-[var(--ops-muted)]">
                          {ticket.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">{requester(ticket)}</td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-[var(--ops-text)]">{formatDateTimeLabel(ticket.last_activity_at)}</div>
                      <div className="mt-1 text-xs text-[var(--ops-muted)]">
                        {ticket.comment_count || 0} comments
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={priorityTone(ticket.priority)}>{humanizeToken(ticket.priority)}</StatusBadge>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={statusTone(ticket.status)}>{humanizeToken(ticket.status)}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </ConsolePanel>
        </div>
      </main>

      <DetailDrawer
        open={drawerMode === 'create'}
        onClose={closeDrawer}
        title="New ticket"
        description="Send a request to WNY Automation."
        footer={
          <div className="flex justify-end gap-3">
            <OpsButton type="button" variant="ghost" onClick={closeDrawer}>
              Cancel
            </OpsButton>
            <OpsButton type="submit" form="ticket-create-form" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Create
            </OpsButton>
          </div>
        }
      >
        <form id="ticket-create-form" onSubmit={createNewTicket} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Title</label>
            <OpsInput
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              maxLength={160}
              placeholder="What needs attention?"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Category</label>
              <OpsSelect
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as TicketCategory }))}
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </OpsSelect>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Priority</label>
              <OpsSelect
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TicketPriority }))}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </OpsSelect>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--ops-text)]">Details</label>
            <OpsTextarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              maxLength={4000}
              placeholder="Add the useful context here."
              required
            />
          </div>
        </form>
      </DetailDrawer>

      <DetailDrawer
        open={drawerMode === 'detail'}
        onClose={closeDrawer}
        title={selectedTicket?.title || 'Ticket'}
        description={selectedTicket ? `${humanizeToken(selectedTicket.category)} / ${requester(selectedTicket)}` : undefined}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-[var(--ops-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading ticket...
          </div>
        ) : selectedTicket ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={statusTone(selectedTicket.status)}>{humanizeToken(selectedTicket.status)}</StatusBadge>
              <StatusBadge tone={priorityTone(selectedTicket.priority)}>{humanizeToken(selectedTicket.priority)}</StatusBadge>
              <StatusBadge tone="muted">{formatDateTimeLabel(selectedTicket.created_at)}</StatusBadge>
            </div>

            {selectedTicket.notification_error && canManage ? (
              <div className="rounded-xl border border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] px-4 py-3 text-sm text-[var(--ops-warning-ink)]">
                Discord notification failed: {selectedTicket.notification_error}
              </div>
            ) : null}

            {canManage ? (
              <div className="grid gap-4 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] p-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Status</span>
                  <OpsSelect
                    value={selectedTicket.status}
                    disabled={submitting}
                    onChange={(event) => void patchTicket({ status: event.target.value as TicketStatus })}
                  >
                    {workflowStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </OpsSelect>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Priority</span>
                  <OpsSelect
                    value={selectedTicket.priority}
                    disabled={submitting}
                    onChange={(event) => void patchTicket({ priority: event.target.value as TicketPriority })}
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </OpsSelect>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Category</span>
                  <OpsSelect
                    value={selectedTicket.category}
                    disabled={submitting}
                    onChange={(event) => void patchTicket({ category: event.target.value as TicketCategory })}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </OpsSelect>
                </label>
              </div>
            ) : null}

            <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-4 py-4">
              <p className="text-sm leading-6 text-[var(--ops-text)] whitespace-pre-wrap">{selectedTicket.description}</p>
            </div>

            <TimelineList
              items={(detail?.comments || []).map((item) => ({
                id: item.id,
                title: item.author_name || item.author_email || humanizeToken(item.author_role),
                body: <p className="whitespace-pre-wrap">{item.body}</p>,
                meta: formatDateTimeLabel(item.created_at),
                tone: roleAtLeast(item.author_role as SessionUser['role'], 'staff') ? 'sky' : 'brand',
              }))}
              empty="No comments yet."
            />

            <form onSubmit={addComment} className="space-y-3">
              <label className="block text-sm font-semibold text-[var(--ops-text)]">Reply</label>
              <OpsTextarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={4000}
                placeholder="Write a reply..."
              />
              <div className="flex justify-end">
                <OpsButton type="submit" variant="primary" disabled={submitting || !comment.trim()}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </OpsButton>
              </div>
            </form>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
