'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  CalendarClock,
  Check,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/ops';

type Bucket = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

type Tenant = {
  id: string;
  name: string;
  email: string;
  display_name: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

type Project = {
  id: string;
  company_id: string;
  title: string;
  status: string | null;
};

type Ticket = {
  id: string;
  bucket_id: string;
  bucket_name: string;
  bucket_color: string;
  company_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requester_email: string | null;
  source: string;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  company_name: string;
  company_email: string;
  company_display_name: string | null;
  company_primary_color: string | null;
  company_accent_color: string | null;
  project_title: string | null;
  project_status: string | null;
  comment_count: number | string;
  latest_comment_body: string | null;
  latest_comment_at: string | null;
};

type BoardResponse = {
  buckets: Bucket[];
  tenants: Tenant[];
  projects: Project[];
  tickets: Ticket[];
};

type TicketFormState = {
  title: string;
  description: string;
  companyId: string;
  projectId: string;
  bucketId: string;
  priority: Ticket['priority'];
  requesterEmail: string;
  dueDate: string;
};

type BucketFormState = {
  name: string;
  color: string;
};

const clientPalette = ['#2f6b4f', '#2563eb', '#9f5b13', '#7c3aed', '#0f766e', '#be123c', '#4f46e5'];
const priorityClasses: Record<Ticket['priority'], string> = {
  low: 'border-slate-200 bg-slate-50 text-slate-600',
  normal: 'border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)] text-[var(--ops-brand-ink)]',
  high: 'border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] text-[var(--ops-warning-ink)]',
  urgent: 'border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] text-[var(--ops-danger-ink)]',
};

function hashIndex(value: string, max: number) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % max;
}

function validHex(value: string | null | undefined) {
  return /^#[0-9a-f]{6}$/i.test(value || '');
}

function clientColor(ticket: Ticket | Tenant) {
  const primary = 'company_primary_color' in ticket ? ticket.company_primary_color : ticket.primary_color;
  const id = 'company_id' in ticket ? ticket.company_id : ticket.id;
  return validHex(primary) ? String(primary) : clientPalette[hashIndex(id, clientPalette.length)];
}

function hexToRgba(hex: string, alpha: number) {
  const fallback = '#2f6b4f';
  const normalized = validHex(hex) ? hex : fallback;
  const raw = normalized.replace('#', '');
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function dateInputValue(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No due date';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function emptyTicketForm(buckets: Bucket[], tenants: Tenant[], bucketId?: string): TicketFormState {
  return {
    title: '',
    description: '',
    companyId: tenants[0]?.id || '',
    projectId: '',
    bucketId: bucketId || buckets[0]?.id || '',
    priority: 'normal',
    requesterEmail: '',
    dueDate: '',
  };
}

export function TicketsTab() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [ticketPanelOpen, setTicketPanelOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [ticketForm, setTicketForm] = useState<TicketFormState>(emptyTicketForm([], []));
  const [bucketPanelOpen, setBucketPanelOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);
  const [bucketForm, setBucketForm] = useState<BucketFormState>({ name: '', color: '#2f6b4f' });

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const filteredTickets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tickets;
    return tickets.filter((ticket) =>
      [
        ticket.title,
        ticket.description,
        ticket.company_display_name,
        ticket.company_name,
        ticket.company_email,
        ticket.project_title,
        ticket.requester_email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [query, tickets]);

  const ticketCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of filteredTickets) {
      counts.set(ticket.bucket_id, (counts.get(ticket.bucket_id) || 0) + 1);
    }
    return counts;
  }, [filteredTickets]);

  const filteredProjects = projects.filter((project) => project.company_id === ticketForm.companyId);

  async function loadBoard() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ticket-board', { cache: 'no-store' });
      const json = (await res.json()) as BoardResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load ticket board.');
      setBuckets(json.buckets || []);
      setTenants(json.tenants || []);
      setProjects(json.projects || []);
      setTickets((json.tickets || []) as Ticket[]);
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not load ticket board.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBoard();
  }, []);

  function openCreateTicket(bucketId?: string) {
    setEditingTicket(null);
    setTicketForm(emptyTicketForm(buckets, tenants, bucketId));
    setTicketPanelOpen(true);
    setNotice(null);
  }

  function openEditTicket(ticket: Ticket) {
    setEditingTicket(ticket);
    setTicketForm({
      title: ticket.title,
      description: ticket.description || '',
      companyId: ticket.company_id,
      projectId: ticket.project_id || '',
      bucketId: ticket.bucket_id,
      priority: ticket.priority,
      requesterEmail: ticket.requester_email || '',
      dueDate: dateInputValue(ticket.due_date),
    });
    setTicketPanelOpen(true);
    setNotice(null);
  }

  function openCreateBucket() {
    setEditingBucket(null);
    setBucketForm({ name: '', color: '#2f6b4f' });
    setBucketPanelOpen(true);
    setNotice(null);
  }

  function openEditBucket(bucket: Bucket) {
    setEditingBucket(bucket);
    setBucketForm({ name: bucket.name, color: bucket.color || '#2f6b4f' });
    setBucketPanelOpen(true);
    setNotice(null);
  }

  async function saveTicket() {
    setSaving(true);
    setNotice(null);
    try {
      const url = editingTicket ? `/api/admin/tickets/${editingTicket.id}` : '/api/admin/tickets';
      const res = await fetch(url, {
        method: editingTicket ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketForm),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save ticket.');
      setNotice({ type: 'success', text: editingTicket ? 'Ticket updated.' : 'Ticket created.' });
      setTicketPanelOpen(false);
      await loadBoard();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not save ticket.' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTicket(ticket: Ticket) {
    if (!window.confirm(`Delete "${ticket.title}"?`)) return;
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not delete ticket.');
      setNotice({ type: 'success', text: 'Ticket deleted.' });
      await loadBoard();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not delete ticket.' });
    }
  }

  async function saveBucket() {
    setSaving(true);
    setNotice(null);
    try {
      const url = editingBucket ? `/api/admin/ticket-buckets/${editingBucket.id}` : '/api/admin/ticket-buckets';
      const res = await fetch(url, {
        method: editingBucket ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bucketForm),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save bucket.');
      setNotice({ type: 'success', text: editingBucket ? 'Bucket updated.' : 'Bucket created.' });
      setBucketPanelOpen(false);
      await loadBoard();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not save bucket.' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteBucket(bucket: Bucket) {
    if (!window.confirm(`Delete "${bucket.name}"? Tickets in it will move to the next bucket.`)) return;
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/ticket-buckets/${bucket.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not delete bucket.');
      setNotice({ type: 'success', text: 'Bucket deleted.' });
      setBucketPanelOpen(false);
      await loadBoard();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not delete bucket.' });
    }
  }

  async function moveTicket(ticketId: string, bucketId: string) {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket || ticket.bucket_id === bucketId) return;

    const previous = tickets;
    setTickets((items) => items.map((item) => (item.id === ticketId ? { ...item, bucket_id: bucketId } : item)));
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not move ticket.');
      await loadBoard();
    } catch (err) {
      setTickets(previous);
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not move ticket.' });
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const ticketId = String(event.active.id);
    const bucketId = event.over?.id ? String(event.over.id) : '';
    if (!bucketId || !buckets.some((bucket) => bucket.id === bucketId)) return;
    void moveTicket(ticketId, bucketId);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--ops-bg)]">
      <header className="border-b border-[var(--ops-border)] bg-[var(--ops-surface-elevated)] px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ops-text)]">Tickets</h1>
            <p className="text-sm text-[var(--ops-muted)]">
              Track client requests, project work, and internal follow-ups in one admin Kanban board.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadBoard()}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--ops-border-strong)] bg-[var(--ops-surface)] px-3 py-2 text-sm font-medium text-[var(--ops-muted-strong)] hover:bg-[var(--ops-surface-subtle)]"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={openCreateBucket}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--ops-border-strong)] bg-[var(--ops-surface)] px-3 py-2 text-sm font-medium text-[var(--ops-muted-strong)] hover:bg-[var(--ops-surface-subtle)]"
            >
              <Plus className="h-4 w-4" /> Bucket
            </button>
            <button
              type="button"
              onClick={() => openCreateTicket()}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--ops-brand)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--ops-brand-strong)]"
            >
              <Plus className="h-4 w-4" /> Ticket
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--ops-muted)]" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search tickets, clients, projects, or requester"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--ops-muted)]" /> : null}
          </div>
          <div className="flex gap-2 text-xs font-medium text-[var(--ops-muted)]">
            <span className="rounded-full bg-[var(--ops-surface-subtle)] px-2.5 py-1">{tickets.length} tickets</span>
            <span className="rounded-full bg-[var(--ops-surface-subtle)] px-2.5 py-1">{tenants.length} clients</span>
          </div>
        </div>
      </header>

      {notice ? (
        <div
          className={`mx-4 mt-4 rounded-lg border px-4 py-3 text-sm lg:mx-6 ${
            notice.type === 'success'
              ? 'border-[var(--ops-success-soft-border)] bg-[var(--ops-success-soft)] text-[var(--ops-success-ink)]'
              : 'border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] text-[var(--ops-danger-ink)]'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 py-4 lg:px-6">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex h-full min-w-max gap-4">
            {buckets.map((bucket) => (
              <KanbanColumn
                key={bucket.id}
                bucket={bucket}
                count={ticketCounts.get(bucket.id) || 0}
                tickets={filteredTickets.filter((ticket) => ticket.bucket_id === bucket.id)}
                loading={loading}
                onCreateTicket={() => openCreateTicket(bucket.id)}
                onEditBucket={() => openEditBucket(bucket)}
                onEditTicket={openEditTicket}
                onDeleteTicket={(ticket) => void deleteTicket(ticket)}
              />
            ))}
            <button
              type="button"
              onClick={openCreateBucket}
              className="flex h-28 w-72 shrink-0 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--ops-border-strong)] bg-[var(--ops-surface)] text-sm font-medium text-[var(--ops-muted-strong)] hover:bg-[var(--ops-surface-subtle)]"
            >
              <Plus className="h-4 w-4" /> Add bucket
            </button>
          </div>
        </DndContext>
      </div>

      {ticketPanelOpen ? (
        <SidePanel title={editingTicket ? 'Edit ticket' : 'Create ticket'} onClose={() => setTicketPanelOpen(false)}>
          <div className="space-y-4">
            <Field label="Title" value={ticketForm.title} onChange={(value) => setTicketForm((form) => ({ ...form, title: value }))} required />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--ops-muted)]">Description</span>
              <textarea
                className="min-h-28 w-full rounded-lg border border-[var(--ops-border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--ops-brand)]"
                value={ticketForm.description}
                onChange={(e) => setTicketForm((form) => ({ ...form, description: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField
                label="Client"
                value={ticketForm.companyId}
                onChange={(value) => setTicketForm((form) => ({ ...form, companyId: value, projectId: '' }))}
                options={tenants.map((tenant) => ({
                  value: tenant.id,
                  label: tenant.display_name || tenant.name,
                }))}
              />
              <SelectField
                label="Bucket"
                value={ticketForm.bucketId}
                onChange={(value) => setTicketForm((form) => ({ ...form, bucketId: value }))}
                options={buckets.map((bucket) => ({ value: bucket.id, label: bucket.name }))}
              />
              <SelectField
                label="Project"
                value={ticketForm.projectId}
                onChange={(value) => setTicketForm((form) => ({ ...form, projectId: value }))}
                options={[
                  { value: '', label: 'No project' },
                  ...filteredProjects.map((project) => ({ value: project.id, label: project.title })),
                ]}
              />
              <SelectField
                label="Priority"
                value={ticketForm.priority}
                onChange={(value) => setTicketForm((form) => ({ ...form, priority: value as Ticket['priority'] }))}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />
              <Field label="Requester email" value={ticketForm.requesterEmail} onChange={(value) => setTicketForm((form) => ({ ...form, requesterEmail: value }))} />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--ops-muted)]">Due date</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-[var(--ops-border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--ops-brand)]"
                  value={ticketForm.dueDate}
                  onChange={(e) => setTicketForm((form) => ({ ...form, dueDate: e.target.value }))}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void saveTicket()}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ops-brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ops-brand-strong)] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save ticket
            </button>
          </div>
        </SidePanel>
      ) : null}

      {bucketPanelOpen ? (
        <SidePanel title={editingBucket ? 'Edit bucket' : 'Create bucket'} onClose={() => setBucketPanelOpen(false)}>
          <div className="space-y-4">
            <Field label="Bucket name" value={bucketForm.name} onChange={(value) => setBucketForm((form) => ({ ...form, name: value }))} required />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--ops-muted)]">Color</span>
              <input
                type="color"
                className="h-10 w-full rounded-lg border border-[var(--ops-border-strong)] bg-white p-1"
                value={bucketForm.color}
                onChange={(e) => setBucketForm((form) => ({ ...form, color: e.target.value }))}
              />
            </label>
            <button
              type="button"
              onClick={() => void saveBucket()}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ops-brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ops-brand-strong)] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save bucket
            </button>
            {editingBucket ? (
              <button
                type="button"
                onClick={() => void deleteBucket(editingBucket)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--ops-danger-ink)]"
              >
                <Trash2 className="h-4 w-4" /> Delete bucket
              </button>
            ) : null}
          </div>
        </SidePanel>
      ) : null}
    </div>
  );
}

function KanbanColumn({
  bucket,
  count,
  tickets,
  loading,
  onCreateTicket,
  onEditBucket,
  onEditTicket,
  onDeleteTicket,
}: {
  bucket: Bucket;
  count: number;
  tickets: Ticket[];
  loading: boolean;
  onCreateTicket: () => void;
  onEditBucket: () => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticket: Ticket) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex h-full w-80 shrink-0 flex-col rounded-lg border bg-[var(--ops-surface)] shadow-[var(--ops-shadow-soft)]',
        isOver ? 'border-[var(--ops-brand)]' : 'border-[var(--ops-border)]',
      )}
    >
      <div className="border-b border-[var(--ops-border)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: bucket.color || '#2f6b4f' }} />
            <h2 className="truncate text-sm font-semibold text-[var(--ops-text)]">{bucket.name}</h2>
            <span className="rounded-full bg-[var(--ops-surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--ops-muted)]">
              {count}
            </span>
          </div>
          <button
            type="button"
            onClick={onEditBucket}
            className="rounded-md p-1.5 text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)] hover:text-[var(--ops-text)]"
            title="Edit bucket"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onCreateTicket}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--ops-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--ops-muted-strong)] hover:bg-[var(--ops-surface-subtle)]"
        >
          <Plus className="h-4 w-4" /> Add ticket
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {loading && tickets.length === 0 ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-32 animate-pulse rounded-lg bg-[var(--ops-surface-subtle)]" />
          ))
        ) : tickets.length ? (
          tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onEdit={() => onEditTicket(ticket)}
              onDelete={() => onDeleteTicket(ticket)}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--ops-border)] bg-white/70 p-4 text-center text-sm text-[var(--ops-muted)]">
            Drop work here or create a ticket.
          </div>
        )}
      </div>
    </section>
  );
}

function TicketCard({ ticket, onEdit, onDelete }: { ticket: Ticket; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id });
  const color = clientColor(ticket);
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    borderLeftColor: color,
    opacity: isDragging ? 0.55 : 1,
  };
  const clientName = ticket.company_display_name || ticket.company_name;
  return (
    <article
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-[var(--ops-border)] border-l-4 bg-white p-3 shadow-[var(--ops-shadow-soft)]"
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab rounded-md p-1 text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)] active:cursor-grabbing"
          title="Drag ticket"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ops-text)]">{ticket.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className="max-w-full truncate rounded-full px-2 py-1 text-xs font-semibold"
              style={{ backgroundColor: hexToRgba(color, 0.12), color }}
            >
              {clientName}
            </span>
            <span className={cn('rounded-full border px-2 py-1 text-xs font-semibold capitalize', priorityClasses[ticket.priority])}>
              {ticket.priority}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1.5 text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)] hover:text-[var(--ops-text)]"
            title="Edit ticket"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-[var(--ops-muted)] hover:bg-[var(--ops-danger-soft)] hover:text-[var(--ops-danger-ink)]"
            title="Delete ticket"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {ticket.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-5 text-[var(--ops-muted-strong)]">{ticket.description}</p>
      ) : null}
      <div className="mt-3 space-y-2 text-xs text-[var(--ops-muted)]">
        {ticket.project_title ? (
          <div className="rounded-md border border-[var(--ops-sky-soft-border)] bg-[var(--ops-sky-soft)] px-2.5 py-2 text-[var(--ops-sky-ink)]">
            <span className="font-semibold">Project:</span> {ticket.project_title}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
            {ticket.due_date ? <CalendarClock className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
            {formatDate(ticket.due_date)}
          </span>
          <span className="shrink-0 rounded-full bg-[var(--ops-surface-subtle)] px-2 py-1 capitalize">
            {ticket.source.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
    </article>
  );
}

function SidePanel({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-[var(--ops-surface)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--ops-border)] bg-[var(--ops-surface)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--ops-text)]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--ops-muted)]">
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        className="w-full rounded-lg border border-[var(--ops-border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--ops-brand)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--ops-muted)]">{label}</span>
      <select
        className="w-full rounded-lg border border-[var(--ops-border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--ops-brand)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value || 'empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
