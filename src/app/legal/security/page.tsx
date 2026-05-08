import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security — WNY Automation Portal',
  description: 'Security practices and controls used by WNY Automation Portal.',
  alternates: { canonical: '/legal/security' },
};

export default function SecurityPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight mb-3">Security</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: April 17, 2026</p>

      <div className="space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Platform controls</h2>
          <p>
            WNY Automation Portal uses managed authentication, encrypted transport, scoped access controls, and application-layer
            tenant checks to protect customer data and internal operations.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Data isolation</h2>
          <p>
            Tenant boundaries are enforced in request handling and database access. Where configured, row-level
            security policies provide an additional isolation layer for multi-tenant workloads.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Payments and secrets</h2>
          <p>
            Payment processing is delegated to Stripe. Credentials and signing keys are stored in environment
            variables and never committed to source control.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Monitoring and response</h2>
          <p>
            Operational monitoring, webhook failure tracking, and audit logs are used to detect and investigate
            suspicious activity. Security incidents are triaged and remediated under internal response procedures.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Reporting security concerns</h2>
          <p>
            Please report vulnerabilities to{' '}
            <a className="text-[var(--brand-orange-600)] hover:underline" href="mailto:security@wnyautomation.com">
              security@wnyautomation.com
            </a>
            . Please do not disclose vulnerabilities publicly before coordinated remediation.
          </p>
        </section>
      </div>
    </>
  );
}
