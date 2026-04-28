'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Event = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  metadata: string | null;
  actor_email: string | null;
  actor_role: string | null;
  ip_address: string | null;
  created_at: string;
};

export default function AuditLogPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const url = filter
          ? `/api/audit-log?action=${encodeURIComponent(filter)}&limit=200`
          : '/api/audit-log?limit=200';
        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json();
        setEvents(json.events || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [filter]);

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Sensitive admin actions from the last 200 events. Only visible to admins.
          </p>
        </div>
        <input
          placeholder="filter action (e.g. payment.refund)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border px-2 py-1 text-sm w-72"
        />
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : events.length === 0 ? (
        <div className="text-sm text-muted-foreground">No events yet.</div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Summary</th>
                <th className="px-4 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{e.actor_email || '—'}</div>
                    <div className="text-xs text-gray-500">{e.actor_role}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">
                    {e.entity_type ? `${e.entity_type}:${e.entity_id || '—'}` : '—'}
                  </td>
                  <td className="px-4 py-2">{e.summary || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{e.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
