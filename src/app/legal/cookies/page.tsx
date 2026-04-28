import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy — WNY Automation Portal',
  description: 'Details about cookies and similar technologies used by WNY Automation Portal.',
  alternates: { canonical: '/legal/cookies' },
};

export default function CookiesPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight mb-3">Cookie policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: April 17, 2026</p>

      <div className="space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">How we use cookies</h2>
          <p>
            WNY Automation Portal uses cookies and similar technologies to keep users signed in, protect forms, remember privacy
            preferences, and measure product and website performance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Categories</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Essential:</span> Authentication and session integrity required for core
              site and app functions.
            </li>
            <li>
              <span className="font-semibold">Security:</span> Anti-abuse, CSRF, and replay-protection mechanisms.
            </li>
            <li>
              <span className="font-semibold">Preference:</span> User consent selections for analytics and optional
              scripts.
            </li>
            <li>
              <span className="font-semibold">Analytics (optional):</span> Aggregated usage and performance metrics
              when consented.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Manage your choices</h2>
          <p>
            You can manage cookie settings through the site consent banner when available and by clearing cookies in
            your browser. Disabling essential cookies may prevent login and app usage.
          </p>
        </section>
      </div>
    </>
  );
}
