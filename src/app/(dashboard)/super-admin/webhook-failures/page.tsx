'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw, PlayCircle } from 'lucide-react';

type Failure = {
  id: string;
  company_id: string | null;
  provider: string;
  event_id: string | null;
  event_type: string | null;
  error_message: string;
  attempt_count: number;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function WebhookFailuresPage() {
  const [rows, setRows] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/webhook-failures?resolved=${showResolved ? '1' : '0'}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setRows(json.failures as Failure[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    load();
  }, [load]);

  async function replay(row: Failure) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/webhook-failures/${row.id}/resolve`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Replay failed');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Replay failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Webhook dead-letter queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stripe (and other provider) webhooks that failed after delivery attempts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            Show resolved
          </label>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <RotateCcw className="size-4" /> Refresh
          </button>
        </div>
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
                <th className="px-3 py-2 font-medium">Received</th>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Attempts</th>
                <th className="px-3 py-2 font-medium">Error</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className={r.resolved_at ? 'opacity-60' : ''}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{r.provider}</td>
                  <td className="px-3 py-2">
                    <div>{r.event_type || '(unknown)'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.event_id}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.company_id || '—'}</td>
                  <td className="px-3 py-2">{r.attempt_count}</td>
                  <td className="px-3 py-2 max-w-md break-words text-red-700">
                    {r.error_message}
                  </td>
                  <td className="px-3 py-2">
                    {!r.resolved_at && (
                      <button
                        type="button"
                        onClick={() => replay(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-60"
                      >
                        <PlayCircle className="size-3" />
                        {busyId === r.id ? 'Replaying…' : 'Replay'}
                      </button>
                    )}
                    {r.resolved_at && (
                      <span className="text-xs text-emerald-700">Resolved</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    {showResolved ? 'No resolved failures.' : 'Queue is empty.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
