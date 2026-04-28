'use client';

import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

type ConsentState = 'unknown' | 'accepted' | 'rejected';

const COOKIE_KEY = 'pos_consent';

function readCookie(name: string): string | null {
  const chunks = document.cookie.split(';').map((v) => v.trim());
  for (const chunk of chunks) {
    if (!chunk.startsWith(`${name}=`)) continue;
    return decodeURIComponent(chunk.slice(name.length + 1));
  }
  return null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function ConsentManager() {
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const value = readCookie(COOKIE_KEY);
      setConsent(value === 'accepted' || value === 'rejected' ? value : 'unknown');
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function set(value: Exclude<ConsentState, 'unknown'>) {
    writeCookie(COOKIE_KEY, value);
    setConsent(value);
  }

  return (
    <>
      {consent === 'accepted' ? (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      ) : null}

      {consent === 'unknown' ? (
        <div className="fixed z-[120] bottom-4 inset-x-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl p-4 text-sm">
          <p className="font-semibold text-[var(--brand-ink)]">Cookie preferences</p>
          <p className="text-slate-600 mt-1">
            We use optional analytics cookies to improve site performance. You can change this choice any time by
            clearing browser cookies.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn-primary text-sm px-3 py-2"
              onClick={() => set('accepted')}
            >
              Accept analytics
            </button>
            <button
              type="button"
              className="btn-ghost-dark text-sm px-3 py-2"
              onClick={() => set('rejected')}
            >
              Decline
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
