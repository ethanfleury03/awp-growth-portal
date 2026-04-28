import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Processing Agreement — WNY Automation Portal',
  description: 'Data processing terms for customers who require controller/processor commitments.',
  alternates: { canonical: '/legal/dpa' },
};

export default function DpaPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight mb-3">Data processing agreement</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: April 17, 2026</p>

      <div className="space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Roles of the parties</h2>
          <p>
            Under this DPA, the customer acts as data controller and WNY Automation Portal acts as data processor for customer
            personal data submitted through the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Processing instructions</h2>
          <p>
            WNY Automation Portal processes data only on documented customer instructions and only as required to provide and
            support contracted services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Security measures</h2>
          <p>
            Technical and organizational safeguards include role-based access controls, encrypted transport, audit
            logs, and incident response procedures aligned with industry-standard practices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Subprocessors and transfers</h2>
          <p>
            Subprocessors are used to provide infrastructure, authentication, communication, and payment services.
            Cross-border transfers are handled using appropriate contractual safeguards where required.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Data subject rights and audits</h2>
          <p>
            WNY Automation Portal assists customers with data subject requests and provides reasonable information necessary to
            demonstrate compliance obligations under applicable privacy law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Requesting a signed copy</h2>
          <p>
            For enterprise procurement, request a signed DPA at{' '}
            <a className="text-[var(--brand-orange-600)] hover:underline" href="mailto:legal@plumber.os">
              legal@plumber.os
            </a>
            .
          </p>
        </section>
      </div>
    </>
  );
}
