import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { getPortalUser } from '@/lib/auth/portal-user';
import Link from 'next/link';
import { MobileJobActions } from './actions';

export default async function MobileJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getPortalUser();
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-medium">Sign in required</p>
          <Link href="/login" className="mt-3 inline-block text-blue-600 underline">
            Sign in to view job
          </Link>
        </div>
      </div>
    );
  }

  const { id } = await params;
  const rows = await sql`
    SELECT j.id, j.description, j.type AS service_type, j.status, j.scheduled_at,
           j.notes, j.plumber_id,
           c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    WHERE j.id = ${id} AND j.company_id = ${user.companyId}
    LIMIT 1
  `;
  const job = rows[0] as Record<string, unknown> | undefined;
  if (!job) return notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white px-4 py-4">
        <Link href="/jobs" className="text-xs opacity-80">
          ← All jobs
        </Link>
        <h1 className="text-xl font-semibold mt-1">{String(job.description)}</h1>
        <p className="text-sm opacity-90 capitalize">
          {String(job.status ?? '')} {job.service_type ? `• ${String(job.service_type)}` : ''}
        </p>
      </header>

      <main className="p-4 space-y-4">
        <section className="bg-white rounded-lg border p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Customer</h2>
          <p className="font-medium">{String(job.customer_name || '—')}</p>
          {Boolean(job.customer_phone) && (
            <a
              href={`tel:${String(job.customer_phone)}`}
              className="mt-1 block text-blue-600 underline text-sm"
            >
              Call {String(job.customer_phone)}
            </a>
          )}
          {Boolean(job.customer_address) && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(String(job.customer_address))}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-blue-600 underline text-sm"
            >
              {String(job.customer_address)} — open in Maps
            </a>
          )}
        </section>

        <section className="bg-white rounded-lg border p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Schedule</h2>
          <p>
            {job.scheduled_at
              ? new Date(String(job.scheduled_at)).toLocaleString()
              : 'Unscheduled'}
          </p>
        </section>

        {Boolean(job.notes) && (
          <section className="bg-white rounded-lg border p-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Notes</h2>
            <p className="whitespace-pre-wrap text-sm">{String(job.notes)}</p>
          </section>
        )}

        <MobileJobActions jobId={String(job.id)} initialStatus={String(job.status)} />
      </main>
    </div>
  );
}
