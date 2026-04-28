import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — WNY Automation Portal',
  description: 'Terms that govern your use of the WNY Automation Portal platform and related services.',
  alternates: { canonical: '/legal/terms' },
};

export default function TermsPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight mb-3">Terms of service</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: April 17, 2026</p>

      <div className="space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Agreement</h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of WNY Automation Portal, including web
            applications, APIs, communications, and related support services. By using the service, you agree to these
            Terms on behalf of your business.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Accounts and responsibilities</h2>
          <p>
            You are responsible for safeguarding account credentials, assigning appropriate user roles, and ensuring
            your team uses the service in compliance with applicable law. You remain responsible for customer-facing
            communications, pricing, invoicing, and field work performed by your business.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Billing and subscriptions</h2>
          <p>
            Paid plans are billed in advance on a recurring basis. Trial, renewal, cancellation, and payment method
            terms are shown at checkout and in your account settings. Third-party payment processing fees are charged
            by your payment processor according to their published rates.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Acceptable use</h2>
          <p>
            You may not use WNY Automation Portal to violate law, send unlawful spam, harass individuals, process fraudulent
            transactions, or interfere with service integrity. Additional conduct restrictions are described in our
            Acceptable Use Policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Data and privacy</h2>
          <p>
            You retain ownership of your business and customer data. We process that data to provide the service as
            described in our Privacy Policy and, where applicable, our Data Processing Agreement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Service availability</h2>
          <p>
            We aim for high availability but do not guarantee uninterrupted operation. Planned maintenance, external
            provider outages, and force majeure events may affect uptime.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Warranty disclaimer and liability limits</h2>
          <p>
            The service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the maximum extent permitted
            by law, WNY Automation Portal disclaims implied warranties and limits liability for indirect, incidental, and
            consequential damages.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Contact</h2>
          <p>
            Questions about these Terms can be sent to{' '}
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
