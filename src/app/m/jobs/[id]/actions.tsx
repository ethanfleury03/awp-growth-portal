'use client';

import { useState } from 'react';

const STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];

export function MobileJobActions({
  jobId,
  initialStatus,
}: {
  jobId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function updateStatus(next: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId, status: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setStatus(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId, notes: note }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setNote('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white rounded-lg border p-4 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Status</h2>
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy || s === status}
              onClick={() => updateStatus(s)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                s === status
                  ? 'bg-blue-600 text-white'
                  : 'border bg-white hover:bg-gray-50'
              } disabled:opacity-60`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Append note</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-md border p-2 text-sm"
          placeholder="Parts used, follow-up needed, issues…"
        />
        <button
          type="button"
          disabled={busy || !note.trim()}
          onClick={saveNote}
          className="mt-2 rounded-md bg-blue-600 text-white px-3 py-2 text-sm disabled:opacity-60"
        >
          Save note
        </button>
      </div>
    </section>
  );
}
