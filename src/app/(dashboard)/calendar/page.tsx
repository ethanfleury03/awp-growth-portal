'use client';

import { useEffect, useMemo, useState } from 'react';
import { addHours, format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Calendar as BigCalendar, dateFnsLocalizer, type EventProps, type View } from 'react-big-calendar';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, User } from 'lucide-react';
import {
  AppPageHeader,
  DetailDrawer,
  KpiStrip,
  SearchField,
  SegmentedFilterBar,
  StatCard,
  StatusBadge,
  opsButtonClass,
} from '@/components/ops/ui';
import { buildDateFromParts, formatDateTimeLabel, formatTimeLabel, humanizeToken } from '@/lib/ops';

interface Job {
  id: string;
  type: string;
  customer_name?: string;
  customer_address?: string;
  plumber_name?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  scheduled_at?: string | null;
  status: string;
  description?: string;
}

type CalendarJobEvent = {
  title: string;
  start: Date;
  end: Date;
  resource: Job;
};

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales,
});

const viewTabs = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
] as const;

function eventTone(status: string) {
  if (status === 'completed') return '#1f9b6d';
  if (status === 'in_progress') return '#cb891c';
  return '#2169ff';
}

function CalendarEventCard({ event }: EventProps<CalendarJobEvent>) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
        {event.resource.scheduled_at ? formatTimeLabel(event.resource.scheduled_at) : event.resource.scheduled_time || 'Any time'}
      </span>
      <span className="truncate text-sm font-semibold text-white">{event.resource.type}</span>
      <span className="truncate text-xs text-white/85">{event.resource.customer_name || 'Unassigned customer'}</span>
    </div>
  );
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('week');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/jobs?limit=200');
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          return;
        }
        setJobs(data.jobs || []);
      } catch {
        setError('Failed to fetch jobs');
      } finally {
        setLoading(false);
      }
    };

    void fetchJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return jobs;
    return jobs.filter((job) =>
      [job.type, job.customer_name, job.customer_address, job.plumber_name, job.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [jobs, search]);

  const events = useMemo<CalendarJobEvent[]>(() => {
    return filteredJobs
      .map((job) => {
        const start = job.scheduled_at ? new Date(job.scheduled_at) : buildDateFromParts(job.scheduled_date, job.scheduled_time);
        if (!start || Number.isNaN(start.getTime())) return null;
        const end = addHours(start, 1);
        return {
          title: job.type,
          start,
          end,
          resource: job,
        };
      })
      .filter(Boolean) as CalendarJobEvent[];
  }, [filteredJobs]);

  const jobsToday = useMemo(() => {
    const today = new Date();
    return events.filter((event) => event.start.toDateString() === today.toDateString()).length;
  }, [events]);

  const inProgressToday = filteredJobs.filter((job) => job.status === 'in_progress').length;

  const navigateWindow = (direction: -1 | 1) => {
    setCurrentDate((previous) => {
      const next = new Date(previous);
      next.setDate(next.getDate() + direction * (currentView === 'month' ? 30 : currentView === 'day' ? 1 : 7));
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1850px] flex-col gap-6">
          <AppPageHeader
            eyebrow="Scheduling / Calendar"
            icon={CalendarDays}
            title="Scheduling calendar"
            description="The schedule now runs on a real operations calendar with status-aware events, denser week/day views, and a persistent detail drawer."
            actions={
              <>
                <SearchField
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search jobs, customers, plumbers…"
                  className="min-w-[min(360px,100%)]"
                />
                <button type="button" onClick={() => setCurrentDate(new Date())} className={opsButtonClass('secondary')}>
                  Today
                </button>
              </>
            }
          />

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <KpiStrip className="xl:grid-cols-4">
            <StatCard label="Visible jobs" value={loading ? '…' : events.length} meta={`${filteredJobs.length} jobs in current search`} tone="brand" icon={CalendarDays} />
            <StatCard label="Today" value={loading ? '…' : jobsToday} meta="Scheduled on today's board" tone="brand" icon={CalendarDays} />
            <StatCard label="In progress" value={loading ? '…' : inProgressToday} meta="Live field work" tone="warning" icon={CalendarDays} />
            <StatCard label="Assigned techs" value={loading ? '…' : new Set(filteredJobs.map((job) => job.plumber_name).filter(Boolean)).size} meta="Distinct visible assignees" tone="success" icon={User} />
          </KpiStrip>

          <div className="rounded-[32px] border border-[var(--ops-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,255,0.96))] px-5 py-5 shadow-[var(--ops-shadow-soft)]">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => navigateWindow(-1)} className={opsButtonClass('secondary', 'sm')}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-[220px] text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Current window</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--ops-text)]">
                    {format(currentDate, currentView === 'day' ? 'MMMM d, yyyy' : 'MMMM yyyy')}
                  </p>
                </div>
                <button type="button" onClick={() => navigateWindow(1)} className={opsButtonClass('secondary', 'sm')}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <SegmentedFilterBar
                value={currentView}
                onChange={(value) => setCurrentView(value as View)}
                options={viewTabs.map((tab) => ({ value: tab.value, label: tab.label }))}
              />
            </div>

            <div className="h-[760px]">
              <BigCalendar<CalendarJobEvent>
                localizer={localizer}
                events={events}
                date={currentDate}
                view={currentView}
                onNavigate={(date) => setCurrentDate(date)}
                onView={(view) => setCurrentView(view)}
                onSelectEvent={(event) => setSelectedJob(event.resource)}
                startAccessor="start"
                endAccessor="end"
                toolbar={false}
                components={{ event: CalendarEventCard }}
                eventPropGetter={(event) => ({
                  style: {
                    background: `linear-gradient(180deg, ${eventTone(event.resource.status)}, ${eventTone(event.resource.status)})`,
                    color: '#ffffff',
                    borderRadius: '16px',
                  },
                })}
              />
            </div>
          </div>
        </div>
      </main>

      <DetailDrawer
        open={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
        title={selectedJob?.type || 'Job detail'}
        description={selectedJob?.customer_name || 'Scheduled work'}
        footer={
          <div className="flex justify-end">
            <button type="button" onClick={() => setSelectedJob(null)} className={opsButtonClass('secondary')}>
              Close
            </button>
          </div>
        }
      >
        {selectedJob ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={selectedJob.status === 'completed' ? 'success' : selectedJob.status === 'in_progress' ? 'warning' : 'brand'}>
                {humanizeToken(selectedJob.status)}
              </StatusBadge>
              {selectedJob.plumber_name ? <StatusBadge tone="neutral">{selectedJob.plumber_name}</StatusBadge> : null}
            </div>

            <div className="rounded-[24px] border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Scheduled</p>
              <p className="mt-2 text-sm text-[var(--ops-text)]">
                {selectedJob.scheduled_at
                  ? formatDateTimeLabel(selectedJob.scheduled_at)
                  : selectedJob.scheduled_date
                    ? `${selectedJob.scheduled_date} ${selectedJob.scheduled_time || ''}`.trim()
                    : 'Not scheduled yet'}
              </p>
            </div>

            <div className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-[var(--ops-muted)]" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Service address</p>
                  <p className="mt-2 text-sm text-[var(--ops-text)]">{selectedJob.customer_address || 'No address supplied'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-4 w-4 text-[var(--ops-muted)]" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Assigned tech</p>
                  <p className="mt-2 text-sm text-[var(--ops-text)]">{selectedJob.plumber_name || 'Needs assignment'}</p>
                </div>
              </div>
            </div>

            {selectedJob.description ? (
              <div className="rounded-[24px] border border-[var(--ops-border)] bg-white px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">Description</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ops-text)]">{selectedJob.description}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
