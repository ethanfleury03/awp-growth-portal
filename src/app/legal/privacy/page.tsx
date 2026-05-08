import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — WNY Automation Portal',
  description: 'How WNY Automation Portal collects, uses, shares, and protects personal data.',
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight mb-3">Privacy policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: April 17, 2026</p>

      <div className="space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Scope</h2>
          <p>
            This policy explains how WNY Automation Portal handles personal information for website visitors, account users, and
            customer records processed through the platform on behalf of service businesses.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Data we collect</h2>
          <p>
            Depending on your use of the service, we may collect account details, billing details, communication
            content, call metadata, customer contact records, and product usage diagnostics.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. How we use data</h2>
          <p>
            We use data to provide and secure the product, process transactions, improve reliability, support
            integrations, and respond to legal or contractual obligations.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Data sharing</h2>
          <p>
            We share data with subprocessors only as needed to operate the platform (for example authentication,
            hosting, messaging, and payments). We do not sell customer personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Retention and security</h2>
          <p>
            Data is retained for as long as needed for service delivery, legal compliance, and dispute resolution.
            Security controls include encrypted transport, access controls, audit logging, and ongoing monitoring.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Your rights</h2>
          <p>
            Depending on jurisdiction, users may request access, correction, deletion, or export of personal
            information. Requests can be sent to{' '}
            <a className="text-[var(--brand-orange-600)] hover:underline" href="mailto:privacy@wnyautomation.com">
              privacy@wnyautomation.com
            </a>
            .
          </p>
        </section>
      </div>
    </>
  );
}
