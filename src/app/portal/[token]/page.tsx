import { notFound } from 'next/navigation';
import Link from 'next/link';

interface PortalData {
  customer: { id: string; name: string; email: string | null; phone: string | null; address: string | null };
  company: { name: string; email: string; phone: string | null } | null;
  invoices: {
    id: string;
    invoice_number: string;
    status: string;
    total_cents: number;
    issue_date: string;
    due_date: string | null;
    public_pay_token: string | null;
  }[];
  estimates: {
    id: string;
    estimate_number: string;
    status: string;
    total_cents: number | null;
    customer_public_token: string | null;
    issued_at: string | null;
  }[];
  jobs: {
    id: string;
    description: string;
    status: string;
    scheduled_at: string | null;
    service_type: string | null;
  }[];
}

async function loadPortal(token: string): Promise<PortalData | null> {
  const base = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || '3003'}`;
  const res = await fetch(`${base}/api/public/portal/${token}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as PortalData;
}

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function CustomerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadPortal(token);
  if (!data) return notFound();

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">{data.company?.name || 'Your account'}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Welcome {data.customer.name} — below are your open estimates, invoices, and job history.
          </p>
        </header>

        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Invoices</h2>
          <div className="bg-white rounded-lg border divide-y">
            {data.invoices.map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">Invoice #{inv.invoice_number}</div>
                  <div className="text-sm text-gray-600">
                    {fmtMoney(inv.total_cents)} •{' '}
                    <span className="capitalize">{inv.status}</span> • Issued {inv.issue_date}
                  </div>
                </div>
                {inv.status !== 'paid' && inv.public_pay_token && (
                  <Link
                    href={`/pay/invoice/${inv.public_pay_token}`}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-white text-sm font-medium hover:bg-emerald-700"
                  >
                    Pay now
                  </Link>
                )}
              </div>
            ))}
            {data.invoices.length === 0 && (
              <div className="p-6 text-center text-gray-500 text-sm">No invoices yet.</div>
            )}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Estimates</h2>
          <div className="bg-white rounded-lg border divide-y">
            {data.estimates.map((est) => (
              <div key={est.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">Estimate #{est.estimate_number}</div>
                  <div className="text-sm text-gray-600">
                    {fmtMoney(est.total_cents ?? null)} •{' '}
                    <span className="capitalize">{est.status}</span>
                  </div>
                </div>
                {est.customer_public_token && (
                  <Link
                    href={`/estimate/${est.customer_public_token}`}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    View
                  </Link>
                )}
              </div>
            ))}
            {data.estimates.length === 0 && (
              <div className="p-6 text-center text-gray-500 text-sm">No estimates yet.</div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-3">Service history</h2>
          <div className="bg-white rounded-lg border divide-y">
            {data.jobs.map((job) => (
              <div key={job.id} className="p-4">
                <div className="font-medium">{job.description}</div>
                <div className="text-sm text-gray-600">
                  {job.service_type ? `${job.service_type} • ` : ''}
                  <span className="capitalize">{job.status}</span>
                  {job.scheduled_at ? ` • ${new Date(job.scheduled_at).toLocaleString()}` : ''}
                </div>
              </div>
            ))}
            {data.jobs.length === 0 && (
              <div className="p-6 text-center text-gray-500 text-sm">No jobs yet.</div>
            )}
          </div>
        </section>

        <footer className="mt-10 text-center text-xs text-gray-400">
          Questions? Contact {data.company?.email || data.company?.phone || 'your service provider'}.
        </footer>
      </div>
    </div>
  );
}
