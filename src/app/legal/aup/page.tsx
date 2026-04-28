import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — WNY Automation Portal',
  description: 'Rules for lawful and responsible use of the WNY Automation Portal platform.',
  alternates: { canonical: '/legal/aup' },
};

export default function AcceptableUsePage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight mb-3">Acceptable use policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: April 17, 2026</p>

      <div className="space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Permitted use</h2>
          <p>
            You may use WNY Automation Portal to operate your business, communicate with customers, schedule jobs, and manage
            invoices, payments, and service records in accordance with applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Prohibited activities</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Sending fraudulent, abusive, or unlawful communications.</li>
            <li>Attempting unauthorized access to accounts, systems, or data.</li>
            <li>Interfering with service stability through scraping, overload, or automated abuse.</li>
            <li>Uploading malware or content that infringes intellectual property rights.</li>
            <li>Using the platform to violate privacy, consumer protection, or telecom regulations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Enforcement</h2>
          <p>
            We may suspend or terminate access for violations of this policy, including immediate action where needed
            to protect users, customers, or platform integrity.
          </p>
        </section>
      </div>
    </>
  );
}
