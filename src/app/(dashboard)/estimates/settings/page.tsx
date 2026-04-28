'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

type PaySettings = {
  online_payments_enabled: boolean;
  estimate_deposits_enabled: boolean;
  invoice_payments_enabled: boolean;
};

export default function EstimateSettingsPage() {
  const [s, setS] = useState<Record<string, unknown> | null>(null);
  const [pay, setPay] = useState<PaySettings | null>(null);
  const [stripeOk, setStripeOk] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/estimates/settings')
      .then((r) => r.json())
      .then((j) => setS(j.settings))
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    fetch('/api/company/payment-settings')
      .then((r) => r.json())
      .then((j) => {
        if (j.settings) {
          setPay({
            online_payments_enabled: Boolean(j.settings.online_payments_enabled),
            estimate_deposits_enabled: Boolean(j.settings.estimate_deposits_enabled),
            invoice_payments_enabled: Boolean(j.settings.invoice_payments_enabled),
          });
          setStripeOk(Boolean(j.stripeSecretConfigured));
        }
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      estimate_prefix: String(fd.get('estimate_prefix') || 'EST'),
      company_name: String(fd.get('company_name') || ''),
      default_expiration_days: parseInt(String(fd.get('default_expiration_days') || '30'), 10),
      default_tax_rate_basis_points:
        fd.get('tax_bps') === '' ? null : parseInt(String(fd.get('tax_bps')), 10),
      default_terms_text: String(fd.get('default_terms_text') || ''),
      estimate_footer_text: String(fd.get('estimate_footer_text') || ''),
      allow_customer_reject: fd.get('allow_customer_reject') === 'on',
    };
    const res = await fetch('/api/estimates/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error || 'Failed');
      return;
    }
    setS(j.settings);
    setErr('');
    alert('Saved');
  }

  async function savePayments(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      online_payments_enabled: fd.get('online_payments_enabled') === 'on',
      estimate_deposits_enabled: fd.get('estimate_deposits_enabled') === 'on',
      invoice_payments_enabled: fd.get('invoice_payments_enabled') === 'on',
    };
    const res = await fetch('/api/company/payment-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error || 'Failed');
      return;
    }
    setPay({
      online_payments_enabled: Boolean(j.settings.online_payments_enabled),
      estimate_deposits_enabled: Boolean(j.settings.estimate_deposits_enabled),
      invoice_payments_enabled: Boolean(j.settings.invoice_payments_enabled),
    });
    setStripeOk(Boolean(j.stripeSecretConfigured));
    setErr('');
    alert('Payment settings saved');
  }

  if (!s) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
        <div className="p-8 text-gray-500">{err || 'Loading…'}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 min-h-0 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <Link
            href="/estimates"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Estimates
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 mt-3">Estimate defaults</h1>
          <p className="text-gray-500 text-sm mt-1">Branding, numbering, and customer-facing defaults.</p>
        </header>
        <div className="p-8 max-w-2xl space-y-8">
          {pay ? (
            <form
              onSubmit={savePayments}
              className="space-y-4 bg-white border border-gray-100 rounded-xl p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-gray-900">Online payments (Stripe)</h2>
              <p className="text-sm text-gray-600">
                Charges use one platform Stripe account (server keys). Customers pay via Stripe Checkout.
              </p>
              {!stripeOk ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <code className="text-xs">STRIPE_SECRET_KEY</code> is not set — payment buttons stay disabled until
                  your host configures Stripe.
                </p>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="online_payments_enabled"
                  defaultChecked={pay.online_payments_enabled}
                />
                Enable online payments for this company
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="estimate_deposits_enabled"
                  defaultChecked={pay.estimate_deposits_enabled}
                />
                Collect estimate deposits (requires deposit amount on the estimate)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="invoice_payments_enabled"
                  defaultChecked={pay.invoice_payments_enabled}
                />
                Allow invoice payment links
              </label>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
              >
                Save payment settings
              </button>
            </form>
          ) : null}
          <form onSubmit={save} className="space-y-4 bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <div>
          <label className="text-sm font-medium text-gray-700">Company display name</label>
          <input
            name="company_name"
            defaultValue={String(s.company_name)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Number prefix</label>
          <input
            name="estimate_prefix"
            defaultValue={String(s.estimate_prefix)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Default expiration (days)</label>
          <input
            name="default_expiration_days"
            type="number"
            defaultValue={String(s.default_expiration_days)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Default tax (basis points, e.g. 825 = 8.25%)</label>
          <input
            name="tax_bps"
            defaultValue={s.default_tax_rate_basis_points != null ? String(s.default_tax_rate_basis_points) : ''}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="leave blank for none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Default terms</label>
          <textarea
            name="default_terms_text"
            defaultValue={String(s.default_terms_text || '')}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[100px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Footer on customer view</label>
          <textarea
            name="estimate_footer_text"
            defaultValue={String(s.estimate_footer_text || '')}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allow_customer_reject" defaultChecked={Boolean(s.allow_customer_reject)} />
          Allow customer to reject from public link
        </label>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition"
        >
          Save
        </button>
      </form>
        </div>
      </main>
    </div>
  );
}
