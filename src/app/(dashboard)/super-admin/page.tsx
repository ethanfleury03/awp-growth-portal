'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Tenant = {
  id: string;
  name: string;
  created_at: string;
  stripe_connect_status: string | null;
  user_count: number;
  invoice_count: number;
  paid_cents: number;
};

function fmtMoney(cents: number | null | undefined) {
  return `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SuperAdminHome() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/tenants', { cache: 'no-store' });
        const json = await res.json();
        setTenants(json.tenants || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Super admin</h1>
        <p className="text-sm text-muted-foreground">All tenants on the platform. Access restricted to super_admin role.</p>
      </header>

      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/super-admin/webhook-failures" className="rounded border px-3 py-1.5 hover:bg-gray-50">
          Webhook failures (DLQ)
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Tenant</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Connect</th>
                <th className="px-4 py-2 text-right">Users</th>
                <th className="px-4 py-2 text-right">Invoices</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{t.id}</div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs">
                    {t.stripe_connect_status ? (
                      <span className="rounded bg-gray-100 px-2 py-0.5">{t.stripe_connect_status}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{t.user_count}</td>
                  <td className="px-4 py-2 text-right">{t.invoice_count}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmtMoney(t.paid_cents)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/super-admin/tenants/${t.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
