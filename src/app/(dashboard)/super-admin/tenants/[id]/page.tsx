'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';

const KNOWN_FLAGS = [
  { key: 'payments.enabled', label: 'Payments / Checkout' },
  { key: 'receptionist.enabled', label: 'AI Receptionist' },
  { key: 'sms.notifications', label: 'SMS Notifications' },
  { key: 'dispatch.enabled', label: 'Dispatch board' },
  { key: 'reports.enabled', label: 'Reports' },
];

type Flag = { flag_key: string; enabled: number | boolean; payload: string | null };

export default function SuperAdminTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/feature-flags?companyId=${id}`, { cache: 'no-store' });
      const json = await res.json();
      const map: Record<string, boolean> = {};
      for (const f of (json.flags || []) as Flag[]) {
        map[f.flag_key] = f.enabled === 1 || f.enabled === true;
      }
      setFlags(map);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(flagKey: string) {
    setSaving(flagKey);
    try {
      const next = !flags[flagKey];
      await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: id, flagKey, enabled: next }),
      });
      setFlags((f) => ({ ...f, [flagKey]: next }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Tenant controls</h1>
        <p className="text-sm text-muted-foreground font-mono">{id}</p>
      </header>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Feature flags</h2>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        </div>
        <ul className="divide-y">
          {KNOWN_FLAGS.map((f) => {
            const enabled = Boolean(flags[f.key]);
            return (
              <li key={f.key} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium text-sm">{f.label}</div>
                  <div className="text-xs text-gray-500 font-mono">{f.key}</div>
                </div>
                <button
                  onClick={() => toggle(f.key)}
                  disabled={saving === f.key}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    enabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="px-4 py-3 text-xs text-gray-500 border-t">
          Flags are cached for 30s in each server process; expect a small delay before changes take effect across requests.
        </p>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-2">Impersonation</h2>
        <p className="text-xs text-gray-600 mb-3">
          Impersonation is performed through Clerk&apos;s dashboard. Find the tenant&apos;s organization,
          pick an admin user, and use &ldquo;Sign in as user&rdquo; — every action taken while impersonating is
          tagged <code>super_admin.impersonate</code> in the audit log on write.
        </p>
        <a
          href="https://dashboard.clerk.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          <Save className="size-3.5" /> Open Clerk dashboard
        </a>
      </section>
    </div>
  );
}
