'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

type Row = Record<string, unknown>;

function dollars(n: unknown) {
  const x = typeof n === 'number' ? n : Number(n) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(x);
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Row | null>(null);
  const [sourceEstimate, setSourceEstimate] = useState<Row | null>(null);
  const [estimates, setEstimates] = useState<Row[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed');
        if (!cancelled) {
          setJob(j.job as Row);
          setSourceEstimate((j.source_estimate as Row) ?? null);
          setEstimates((j.estimates as Row[]) || []);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
        <div className="p-8 text-center text-gray-500">Loading…</div>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
        <div className="p-8 text-center text-red-600">{err || 'Not found'}</div>
        <Link href="/jobs" className="text-center text-blue-600 text-sm hover:underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const customerId = job.customer_id as string | undefined;
  const leadId = job.lead_id as string | undefined;

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 min-h-0 overflow-auto p-8 max-w-4xl mx-auto space-y-6 w-full">
        <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Jobs
        </Link>
        <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">{String(job.type || 'Job')}</h1>
          <p className="text-sm text-gray-600 capitalize">Status: {String(job.status)}</p>
          {job.customer_name ? (
            <p className="text-sm text-gray-800">
              {String(job.customer_name)}
              {customerId ? (
                <>
                  {' '}
                  ·{' '}
                  <Link href={`/customers/${customerId}`} className="text-blue-600 hover:underline">
                    Customer
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {job.scheduled_date ? (
            <p className="text-sm text-gray-600">
              Scheduled {String(job.scheduled_date)}
              {job.scheduled_time ? ` · ${String(job.scheduled_time)}` : ''}
            </p>
          ) : null}
          {job.estimated_price != null ? (
            <p className="text-sm text-gray-800">Estimated price: {dollars(job.estimated_price)}</p>
          ) : null}
          {job.description ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{String(job.description)}</p>
          ) : null}
          {leadId ? (
            <p className="text-sm pt-2">
              <Link href={`/leads/${leadId}`} className="text-blue-600 hover:underline">
                View lead
              </Link>
            </p>
          ) : null}
        </header>

        {sourceEstimate ? (
          <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-2">Source estimate</h2>
            <p className="text-sm text-gray-700">
              This job was created from{' '}
              <Link href={`/estimates/${sourceEstimate.id}`} className="text-blue-600 font-medium hover:underline">
                {String(sourceEstimate.estimate_number)}
              </Link>
              <span className="text-gray-600"> — {String(sourceEstimate.title)}</span>
              <span className="text-gray-500 capitalize"> · {String(sourceEstimate.status)}</span>
            </p>
          </section>
        ) : null}

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Related estimates</h2>
          {estimates.length === 0 ? (
            <p className="text-sm text-gray-600">No linked estimates.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {estimates.map((e) => (
                <li key={e.id as string}>
                  <Link href={`/estimates/${e.id}`} className="text-blue-600 hover:underline font-medium">
                    {String(e.estimate_number)}
                  </Link>
                  <span className="text-gray-600"> — {String(e.title)}</span>
                  <span className="text-gray-500 capitalize"> · {String(e.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
