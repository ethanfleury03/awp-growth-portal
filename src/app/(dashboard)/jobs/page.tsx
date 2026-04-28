'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  AppPageHeader,
  ConsolePanel,
  DataTable,
  DetailDrawer,
  KpiStrip,
  OpsButton,
  OpsInput,
  OpsSelect,
  OpsTextarea,
  SearchField,
  SegmentedFilterBar,
  StatCard,
  StatusBadge,
} from '@/components/ops/ui';
import { formatCurrency, formatDateLabel, humanizeToken } from '@/lib/ops';

interface Job {
  id: string;
  company_id: string;
  lead_id?: string;
  customer_id?: string;
  plumber_id?: string;
  status: string;
  type: string;
  description?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  started_at?: string;
  completed_at?: string;
  estimated_price?: number;
  final_price?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  plumber_name?: string;
  lead_issue?: string;
  source_estimate_id?: string | null;
}

interface JobStats {
  total: number;
  scheduled: number;
  in_progress: number;
  completed: number;
}

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const jobTypes = [
  'Drain Cleaning',
  'Water Heater',
  'Leak Repair',
  'Pipe Installation',
  'Toilet Repair',
  'Faucet Repair',
  'Sewer Line',
  'Maintenance',
  'Other',
];

type DrawerMode = 'create' | 'edit' | null;

type JobForm = {
  type: string;
  description: string;
  scheduled_date: string;
  scheduled_time: string;
  estimated_price: string;
  notes: string;
  status: string;
};

const emptyForm: JobForm = {
  type: '',
  description: '',
  scheduled_date: '',
  scheduled_time: '',
  estimated_price: '',
  notes: '',
  status: 'scheduled',
};

function jobStatusTone(status: string) {
  if (status === 'completed') return 'success' as const;
  if (status === 'in_progress') return 'warning' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'brand' as const;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats>({ total: 0, scheduled: 0, in_progress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]['value']>('all');
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<JobForm>(emptyForm);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        const jobsData = data.jobs || [];
        setJobs(jobsData);
        setStats({
          total: data.total || jobsData.length,
          scheduled: jobsData.filter((job: Job) => job.status === 'scheduled').length,
          in_progress: jobsData.filter((job: Job) => job.status === 'in_progress').length,
          completed: jobsData.filter((job: Job) => job.status === 'completed').length,
        });
      }
    } catch {
      setError('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const filteredJobs = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return jobs;
    return jobs.filter((job) =>
      [job.customer_name, job.type, job.description, job.plumber_name, job.customer_address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [jobs, search]);

  const openCreateDrawer = () => {
    setSelectedJob(null);
    setForm(emptyForm);
    setDrawerMode('create');
  };

  const openEditDrawer = (job: Job) => {
    setSelectedJob(job);
    setForm({
      type: job.type || '',
      description: job.description || '',
      scheduled_date: job.scheduled_date || '',
      scheduled_time: job.scheduled_time || '',
      estimated_price: job.estimated_price != null ? String(job.estimated_price) : '',
      notes: job.notes || '',
      status: job.status || 'scheduled',
    });
    setDrawerMode('edit');
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setSelectedJob(null);
    setForm(emptyForm);
  };

  const saveJob = async () => {
    if (!form.type.trim()) {
      setError('Job type is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        estimated_price: form.estimated_price ? Number(form.estimated_price) : null,
      };

      const res = await fetch('/api/jobs', {
        method: drawerMode === 'edit' && selectedJob ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:
          drawerMode === 'edit' && selectedJob
            ? JSON.stringify({ id: selectedJob.id, ...payload })
            : JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      closeDrawer();
      await fetchJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedJob) return;
    const confirmed = window.confirm('Delete this job?');
    if (!confirmed) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/jobs?id=${selectedJob.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      closeDrawer();
      await fetchJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete job');
    } finally {
      setSubmitting(false);
    }
  };

  const jobsWithEstimate = filteredJobs.filter((job) => job.source_estimate_id).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
          <AppPageHeader
            eyebrow="Operations / Jobs"
            title="Jobs board"
            description="A denser field-work list that keeps scheduling, assignee context, and job status visible without losing editing speed."
            actions={
              <>
                <SearchField
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search jobs, customers, plumbers…"
                  className="min-w-[min(360px,100%)]"
                />
                <OpsButton type="button" onClick={openCreateDrawer} variant="primary">
                  <Plus className="h-4 w-4" />
                  New job
                </OpsButton>
              </>
            }
          />

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <KpiStrip>
            <StatCard label="Total jobs" value={loading ? '…' : stats.total} meta={`${filteredJobs.length} visible in current search`} tone="brand" icon={Briefcase} />
            <StatCard label="Scheduled" value={loading ? '…' : stats.scheduled} meta="Upcoming field work" tone="brand" icon={Calendar} />
            <StatCard label="In progress" value={loading ? '…' : stats.in_progress} meta="Active technician load" tone="warning" icon={UserRound} />
            <StatCard label="Completed" value={loading ? '…' : stats.completed} meta={`${jobsWithEstimate} sourced from estimates`} tone="success" icon={ClipboardList} />
          </KpiStrip>

          <ConsolePanel
            title="Operations list"
            description="Sticky filters, richer row hierarchy, and a single right-side drawer for creation and editing."
            action={
              <SegmentedFilterBar
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as (typeof statusOptions)[number]['value'])}
                options={statusOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  count:
                    option.value === 'all'
                      ? jobs.length
                      : jobs.filter((job) => job.status === option.value).length,
                }))}
              />
            }
          >
            <DataTable
              columns={[
                { key: 'customer', label: 'Customer' },
                { key: 'service', label: 'Service' },
                { key: 'schedule', label: 'Schedule' },
                { key: 'assignee', label: 'Assignee' },
                { key: 'price', label: 'Price', align: 'right' },
                { key: 'status', label: 'Status' },
              ]}
              footer={`Showing ${filteredJobs.length} of ${jobs.length} jobs`}
              minWidthClassName="min-w-[1080px]"
              className="border-0 shadow-none"
            >
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-[var(--ops-muted)]">
                    Loading jobs…
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-[var(--ops-muted)]">
                    No jobs match this search or filter.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => openEditDrawer(job)}
                    className="cursor-pointer transition-colors hover:bg-[var(--ops-surface-subtle)]"
                  >
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--ops-text)]">{job.customer_name || 'Unassigned customer'}</p>
                        <p className="mt-1 text-xs text-[var(--ops-muted)]">{job.customer_address || 'No service address'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--ops-text)]">{job.type || 'General service'}</p>
                        <p className="max-w-[260px] truncate text-xs text-[var(--ops-muted)]">
                          {job.description || job.lead_issue || 'Open service request'}
                        </p>
                        {job.source_estimate_id ? <StatusBadge tone="sky">Estimate sourced</StatusBadge> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--ops-muted)]">
                      <div className="space-y-1">
                        <p>{job.scheduled_date ? formatDateLabel(job.scheduled_date) : 'Not scheduled yet'}</p>
                        <p className="font-mono text-xs">{job.scheduled_time || 'Any time'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--ops-text)]">
                      {job.plumber_name || 'Needs assignment'}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-[var(--ops-text)]">
                      {formatCurrency(job.final_price ?? job.estimated_price ?? 0)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={jobStatusTone(job.status)}>{humanizeToken(job.status)}</StatusBadge>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </ConsolePanel>
        </div>
      </main>

      <DetailDrawer
        open={drawerMode !== null}
        onClose={closeDrawer}
        title={drawerMode === 'create' ? 'Create new job' : selectedJob?.type || 'Job detail'}
        description={
          drawerMode === 'create'
            ? 'Capture the service type, schedule, and notes without leaving the board.'
            : selectedJob?.customer_name
              ? `${selectedJob.customer_name}${selectedJob.customer_phone ? ` · ${selectedJob.customer_phone}` : ''}`
              : 'Update service details, status, and schedule.'
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {drawerMode === 'edit' && selectedJob ? (
                <OpsButton type="button" variant="ghost" onClick={() => void handleDelete()} disabled={submitting}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </OpsButton>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OpsButton type="button" variant="secondary" onClick={closeDrawer}>
                Cancel
              </OpsButton>
              <OpsButton type="button" variant="primary" onClick={() => void saveJob()} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {drawerMode === 'create' ? 'Create job' : 'Save changes'}
              </OpsButton>
            </div>
          </div>
        }
      >
        <div className="grid gap-4">
          {selectedJob ? (
            <div className="rounded-[24px] border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Current job context</p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[var(--ops-muted)]">Customer</p>
                  <p className="font-semibold text-[var(--ops-text)]">{selectedJob.customer_name || '—'}</p>
                </div>
                <div>
                  <p className="text-[var(--ops-muted)]">Assigned plumber</p>
                  <p className="font-semibold text-[var(--ops-text)]">{selectedJob.plumber_name || 'Needs assignment'}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
              Service type
            </label>
            <OpsSelect value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
              <option value="">Select service type</option>
              {jobTypes.map((jobType) => (
                <option key={jobType} value={jobType}>
                  {jobType}
                </option>
              ))}
            </OpsSelect>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
              Description
            </label>
            <OpsTextarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-[120px]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                Scheduled date
              </label>
              <OpsInput
                type="date"
                value={form.scheduled_date}
                onChange={(event) => setForm((current) => ({ ...current, scheduled_date: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                Scheduled time
              </label>
              <OpsInput
                type="time"
                value={form.scheduled_time}
                onChange={(event) => setForm((current) => ({ ...current, scheduled_time: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                Estimated price
              </label>
              <OpsInput
                type="number"
                min="0"
                step="1"
                value={form.estimated_price}
                onChange={(event) => setForm((current) => ({ ...current, estimated_price: event.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
                Status
              </label>
              <OpsSelect value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                {statusOptions.filter((option) => option.value !== 'all').map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </OpsSelect>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">
              Internal notes
            </label>
            <OpsTextarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="min-h-[110px]"
            />
          </div>
        </div>
      </DetailDrawer>
    </div>
  );
}
