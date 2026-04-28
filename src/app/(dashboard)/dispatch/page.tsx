'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, GripVertical, Loader2, Truck, Users } from 'lucide-react';
import {
  AppPageHeader,
  ConsolePanel,
  KpiStrip,
  OpsSelect,
  StatCard,
  StatusBadge,
  opsButtonClass,
} from '@/components/ops/ui';
import { cn, formatTimeLabel } from '@/lib/ops';

type Job = {
  id: string;
  description: string;
  service_type: string | null;
  status: string;
  scheduled_at: string | null;
  plumber_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  plumber_name: string | null;
};

type Plumber = { id: string; name: string; specialty: string | null; is_active: number };

function DispatchCard({
  job,
  plumbers,
  onAssign,
}: {
  job: Job;
  plumbers: Plumber[];
  onAssign: (jobId: string, plumberId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { type: 'job', jobId: job.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'rounded-[24px] border border-[var(--ops-border)] bg-white px-4 py-4 shadow-[var(--ops-shadow-soft)] transition-shadow',
        isDragging && 'opacity-60 shadow-[0_16px_32px_-24px_rgba(8,18,35,0.72)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--ops-text)]">{job.customer_name || 'Unknown customer'}</p>
          <p className="mt-1 text-xs text-[var(--ops-muted)]">{job.customer_address || 'Service address needed'}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--ops-border)] text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)]"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold text-[var(--ops-text)]">{job.description || job.service_type || 'General service call'}</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={job.status === 'in_progress' ? 'warning' : job.status === 'completed' ? 'success' : 'brand'}>
            {job.status.replace('_', ' ')}
          </StatusBadge>
          {job.service_type ? <StatusBadge tone="neutral">{job.service_type}</StatusBadge> : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--ops-muted)]">
        <span>{job.scheduled_at ? formatTimeLabel(job.scheduled_at) : 'No time set'}</span>
        <span className="font-mono">{job.customer_phone || 'No number'}</span>
      </div>

      <div className="mt-4">
        <OpsSelect
          value={job.plumber_id ?? ''}
          onChange={(event) => onAssign(job.id, event.target.value || null)}
          className="h-10 rounded-xl text-xs"
        >
          <option value="">Unassigned</option>
          {plumbers.map((plumber) => (
            <option key={plumber.id} value={plumber.id}>
              {plumber.name}
            </option>
          ))}
        </OpsSelect>
      </div>
    </div>
  );
}

function DispatchLane({
  id,
  title,
  subtitle,
  jobs,
  plumbers,
  onAssign,
  accent,
}: {
  id: string;
  title: string;
  subtitle: string;
  jobs: Job[];
  plumbers: Plumber[];
  onAssign: (jobId: string, plumberId: string | null) => void;
  accent: 'brand' | 'warning' | 'success' | 'neutral';
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'min-h-[320px] rounded-[28px] border border-[var(--ops-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,255,0.96))] shadow-[var(--ops-shadow-soft)] transition-colors',
        isOver && 'border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)]',
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--ops-border)] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--ops-text)]">{title}</h2>
            <StatusBadge tone={accent}>{jobs.length}</StatusBadge>
          </div>
          <p className="mt-1 text-xs text-[var(--ops-muted)]">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {jobs.length ? (
          jobs.map((job) => (
            <DispatchCard key={job.id} job={job} plumbers={plumbers} onAssign={onAssign} />
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--ops-border-strong)] bg-[var(--ops-surface-subtle)] px-5 py-8 text-center text-sm text-[var(--ops-muted)]">
            No jobs in this lane.
          </div>
        )}
      </div>
    </section>
  );
}

export default function DispatchPage() {
  const [day, setDay] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plumbers, setPlumbers] = useState<Plumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispatch?day=${day}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setJobs(json.jobs as Job[]);
      setPlumbers((json.plumbers as Plumber[]).filter((plumber) => plumber.is_active !== 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    void load();
  }, [load]);

  const unassigned = useMemo(() => jobs.filter((job) => !job.plumber_id), [jobs]);
  const byPlumber = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of jobs) {
      if (!job.plumber_id) continue;
      (map[job.plumber_id] ||= []).push(job);
    }
    return map;
  }, [jobs]);

  async function assign(jobId: string, plumberId: string | null) {
    const res = await fetch('/api/dispatch', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, plumberId }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Failed to update assignment');
      return;
    }
    await load();
  }

  const handleDragStart = (event: DragStartEvent) => {
    const job = jobs.find((entry) => entry.id === String(event.active.id));
    setActiveJob(job || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveJob(null);
    const jobId = String(event.active.id);
    const laneId = event.over?.id ? String(event.over.id) : null;
    if (!laneId) return;
    if (laneId === 'lane-unassigned') {
      await assign(jobId, null);
      return;
    }
    if (laneId.startsWith('lane-plumber-')) {
      await assign(jobId, laneId.replace('lane-plumber-', ''));
    }
  };

  const scheduledCount = jobs.filter((job) => job.scheduled_at).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1850px] flex-col gap-6">
          <AppPageHeader
            eyebrow="Field Ops / Dispatch"
            title="Dispatch board"
            description="Technician lanes are now a real assignment surface: drop work into the right lane, keep an eye on load, and still fall back to select-based reassignment when needed."
            actions={
              <>
                <label className="inline-flex h-11 items-center gap-3 rounded-2xl border border-[var(--ops-border)] bg-white px-4 text-sm font-semibold text-[var(--ops-text)]">
                  <CalendarDays className="h-4 w-4 text-[var(--ops-muted)]" />
                  <input
                    type="date"
                    value={day}
                    onChange={(event) => setDay(event.target.value)}
                    className="bg-transparent outline-none"
                  />
                </label>
                <Link href="/calendar" className={opsButtonClass('secondary')}>
                  Open calendar
                </Link>
              </>
            }
          />

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <KpiStrip className="xl:grid-cols-4">
            <StatCard label="Unassigned" value={loading ? '…' : unassigned.length} meta="Needs dispatcher action" tone="warning" icon={Truck} />
            <StatCard label="Scheduled jobs" value={loading ? '…' : scheduledCount} meta={`${jobs.length} total jobs on board`} tone="brand" icon={CalendarDays} />
            <StatCard label="Active techs" value={loading ? '…' : plumbers.length} meta="Visible lanes today" tone="success" icon={Users} />
            <StatCard label="Average lane load" value={loading ? '…' : plumbers.length ? (jobs.length / plumbers.length).toFixed(1) : '0'} meta="Jobs per tech lane" tone="neutral" icon={Truck} />
          </KpiStrip>

          {loading ? (
            <div className="rounded-[28px] border border-[var(--ops-border)] bg-white px-5 py-16 text-center text-sm text-[var(--ops-muted)] shadow-[var(--ops-shadow-soft)]">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-[var(--ops-brand)]" />
              Loading dispatch board…
            </div>
          ) : (
            <DndContext onDragStart={handleDragStart} onDragEnd={(event) => void handleDragEnd(event)}>
              <ConsolePanel
                title="Assignment lanes"
                description="Drag a job into a technician lane or use the select field inside each card for precise reassignment."
              >
                <div className="grid gap-4 xl:grid-cols-4">
                  <DispatchLane
                    id="lane-unassigned"
                    title="Unassigned queue"
                    subtitle="Work that still needs a technician owner"
                    jobs={unassigned}
                    plumbers={plumbers}
                    onAssign={assign}
                    accent="warning"
                  />

                  {plumbers.map((plumber) => {
                    const laneJobs = byPlumber[plumber.id] || [];
                    return (
                      <DispatchLane
                        key={plumber.id}
                        id={`lane-plumber-${plumber.id}`}
                        title={plumber.name}
                        subtitle={plumber.specialty || 'Field technician'}
                        jobs={laneJobs}
                        plumbers={plumbers}
                        onAssign={assign}
                        accent={laneJobs.length >= 4 ? 'warning' : 'success'}
                      />
                    );
                  })}
                </div>
              </ConsolePanel>

              <DragOverlay>
                {activeJob ? (
                  <div className="w-[320px] rounded-[24px] border border-[var(--ops-border-strong)] bg-white px-4 py-4 shadow-[0_28px_56px_-28px_rgba(8,18,35,0.72)]">
                    <p className="text-sm font-semibold text-[var(--ops-text)]">{activeJob.customer_name || 'Unknown customer'}</p>
                    <p className="mt-1 text-xs text-[var(--ops-muted)]">{activeJob.description || activeJob.service_type || 'Service call'}</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </main>
    </div>
  );
}
