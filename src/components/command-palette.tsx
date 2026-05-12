'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';

type Result = {
  type: 'customer' | 'estimate' | 'lead' | 'growth';
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQuery('');
      setResults([]);
      setActive(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      const json = await res.json();
      if (!ctrl.signal.aborted) setResults(json.results || []);
    } catch {
      /* ignore abort */
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 120);
    return () => clearTimeout(t);
  }, [query, search]);

  function go(r: Result) {
    setOpen(false);
    router.push(r.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const r = results[active];
      if (r) go(r);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-28"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--ops-border-strong)] bg-[var(--ops-surface-strong)] shadow-[0_18px_44px_-30px_rgba(8,18,35,0.52)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--ops-border)] px-5 py-4">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-[var(--ops-muted)]" />
          ) : (
            <Search className="size-4 text-[var(--ops-muted)]" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Search cabin leads, contacts, estimates, and growth work..."
            className="flex-1 bg-transparent text-sm text-[var(--ops-text)] outline-none placeholder:text-[var(--ops-muted)]"
          />
          <kbd className="rounded-md border border-[var(--ops-border)] bg-white px-2 py-1 text-xs text-[var(--ops-muted)]">Esc</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query.trim().length >= 2 && !loading && (
            <div className="px-4 py-10 text-center text-sm text-[var(--ops-muted)]">No results</div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
              className={`flex w-full items-center justify-between border-b border-[var(--ops-border)] px-5 py-3 text-left transition-colors last:border-b-0 ${
                i === active ? 'bg-[var(--ops-brand-soft)]' : 'bg-transparent hover:bg-[var(--ops-surface-subtle)]'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--ops-text)]">{r.title}</div>
                <div className="truncate text-xs text-[var(--ops-muted)]">{r.subtitle}</div>
              </div>
              <span className="ml-4 rounded-full border border-[var(--ops-border)] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ops-muted)]">
                {r.type}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
