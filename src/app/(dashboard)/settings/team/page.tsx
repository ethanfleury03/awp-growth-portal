'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw, UserX } from 'lucide-react';

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: 'super_admin' | 'admin' | 'dispatcher' | 'staff' | 'tech' | 'viewer';
  is_active: number;
  clerk_user_id: string | null;
  created_at: string;
};

const ROLES: Member['role'][] = ['admin', 'dispatcher', 'staff', 'tech', 'viewer'];

export default function TeamSettingsPage() {
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/team', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setRows(json.members as Member[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(m: Member, role: Member['role']) {
    const res = await fetch(`/api/team/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) alert((await res.json()).error || 'Failed');
    load();
  }

  async function deactivate(m: Member) {
    if (!confirm(`Deactivate ${m.email}?`)) return;
    const res = await fetch(`/api/team/${m.id}`, { method: 'DELETE' });
    if (!res.ok) alert((await res.json()).error || 'Failed');
    load();
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team &amp; roles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Members sync from Clerk — invite new users in your Clerk dashboard, then set their
            role here.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          <RotateCcw className="size-4" /> Refresh
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => (
                <tr key={m.id} className={m.is_active ? '' : 'opacity-60'}>
                  <td className="px-3 py-2">{m.name || '—'}</td>
                  <td className="px-3 py-2">{m.email}</td>
                  <td className="px-3 py-2">
                    {m.role === 'super_admin' ? (
                      <span className="text-xs font-medium text-purple-700">super_admin</span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m, e.target.value as Member['role'])}
                        className="rounded-md border px-2 py-1 text-sm"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.is_active ? (
                      <span className="text-xs text-emerald-700">Active</span>
                    ) : (
                      <span className="text-xs text-gray-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {m.role !== 'super_admin' && m.is_active === 1 && (
                      <button
                        type="button"
                        onClick={() => deactivate(m)}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        <UserX className="size-3" /> Deactivate
                      </button>
                    )}
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
