'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Edit3, Mail, MapPin, Phone, Save, StickyNote, Trash2, X } from 'lucide-react';

type Row = Record<string, unknown>;
type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

const emptyForm: CustomerForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
};

function money(cents: unknown) {
  const n = typeof cents === 'number' ? cents : Number(cents) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
}

function field(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function formFromCustomer(customer: Row): CustomerForm {
  return {
    name: field(customer.name),
    email: field(customer.email),
    phone: field(customer.phone),
    address: field(customer.address),
    notes: field(customer.notes),
  };
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Row | null>(null);
  const [jobs, setJobs] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [estimates, setEstimates] = useState<Row[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customers/${id}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed');
        if (!cancelled) {
          setCustomer(j.customer as Row);
          setForm(formFromCustomer(j.customer as Row));
          setJobs((j.jobs as Row[]) || []);
          setInvoices((j.invoices as Row[]) || []);
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

  const updateForm = (fieldName: keyof CustomerForm, value: string) => {
    setForm((current) => ({ ...current, [fieldName]: value }));
    setFormError('');
    setSuccessMessage('');
  };

  const handleCancelEdit = () => {
    if (customer) setForm(formFromCustomer(customer));
    setEditing(false);
    setFormError('');
    setSuccessMessage('');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update customer');

      const updatedCustomer = data.customer as Row;
      setCustomer(updatedCustomer);
      setForm(formFromCustomer(updatedCustomer));
      setEditing(false);
      setSuccessMessage('Customer contact updated.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this customer? Related jobs, invoices, and estimates will stay in the system without this customer attached.')) {
      return;
    }

    setDeleting(true);
    setFormError('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete customer');
      router.push('/customers');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to delete customer');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
        <div className="p-8 text-center text-gray-500">Loading…</div>
      </div>
    );
  }
  if (!customer) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
        <div className="p-8 text-center text-red-600">{err || 'Not found'}</div>
        <Link href="/customers" className="text-center text-blue-600 text-sm hover:underline">
          Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 xl:p-8 max-w-4xl mx-auto space-y-6 w-full">
        <Link
          href="/customers"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Customers
        </Link>
        <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Customer Contact</p>
                {editing ? (
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(event) => updateForm('name', event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-2xl font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Customer name"
                  />
                ) : (
                  <h1 className="mt-1 text-2xl font-semibold text-gray-900">{String(customer.name)}</h1>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {editing ? (
                  <>
                    <button
                      type="submit"
                      disabled={saving || deleting}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={saving || deleting}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setFormError('');
                      setSuccessMessage('');
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit contact
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || deleting}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>

            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </div>
            ) : null}

            {editing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="pat@example.com"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">Phone *</span>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(event) => updateForm('phone', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="(716) 555-0180"
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-sm font-medium text-gray-700">Address</span>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(event) => updateForm('address', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="214 Test Harbor Rd, Buffalo, NY"
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-sm font-medium text-gray-700">Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateForm('notes', event.target.value)}
                    className="min-h-28 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Contact preferences, project context, or follow-up notes"
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Email</p>
                    <p className="mt-1 break-words text-sm text-gray-700">{customer.email ? String(customer.email) : 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Phone</p>
                    <p className="mt-1 break-words text-sm text-gray-700">{customer.phone ? String(customer.phone) : 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Address</p>
                    <p className="mt-1 break-words text-sm text-gray-700">{customer.address ? String(customer.address) : 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">
                      {customer.notes ? String(customer.notes) : 'No notes yet.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </header>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Estimates</h2>
          {estimates.length === 0 ? (
            <p className="text-sm text-gray-600">No estimates for this customer.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {estimates.map((e) => (
                <li key={e.id as string}>
                  <Link href={`/estimates/${e.id}`} className="text-blue-600 hover:underline font-medium">
                    {String(e.estimate_number)}
                  </Link>
                  <span className="text-gray-600"> — {String(e.title)}</span>
                  <span className="text-gray-500 capitalize"> · {String(e.status)}</span>
                  <span className="text-gray-800 font-mono"> · {money(e.total_amount_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Jobs</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-gray-600">No jobs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {jobs.map((j) => (
                <li key={j.id as string}>
                  <Link href={`/jobs/${j.id}`} className="text-blue-600 hover:underline font-medium">
                    {String(j.type || 'Job')}
                  </Link>
                  <span className="text-gray-500 capitalize"> · {String(j.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-600">No invoices.</p>
          ) : (
            <ul className="space-y-1 text-sm text-gray-700">
              {invoices.map((inv) => (
                <li key={inv.id as string}>{String(inv.id).slice(0, 8)}…</li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
