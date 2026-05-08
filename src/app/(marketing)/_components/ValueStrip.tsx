import { PhoneIncoming, CalendarCheck2, Wallet } from 'lucide-react';

const VALUES = [
  {
    icon: PhoneIncoming,
    title: 'Every inquiry becomes a lead',
    body: 'Website, phone, email, referral, and outreach responses land in a structured cabin-buyer pipeline with the right qualification fields.',
  },
  {
    icon: CalendarCheck2,
    title: 'Every buyer has a next step',
    body: 'Track planning calls, site readiness, utility questions, estimates, follow-ups, and nurture timing without hunting through notes.',
  },
  {
    icon: Wallet,
    title: 'Every proposal stays connected',
    body: 'Estimates, invoices, customer history, campaign source, and AI context stay tied to the same account record.',
  },
];

export function ValueStrip() {
  return (
    <section className="relative bg-[var(--brand-cream)] pt-36 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">Why operators switch</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Built for the three moments that actually move cabin sales.
          </h2>
          <p className="mt-4 text-[var(--brand-slate)] text-lg">
            Deals get lost when inquiry details, site constraints, estimates, and follow-up notes split across tools.
            WNY Automation Portal keeps those handoffs visible and accountable.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="brand-card p-7">
              <div className="h-12 w-12 rounded-xl bg-[var(--brand-navy-800)] text-white flex items-center justify-center shadow-[0_10px_30px_-14px_rgba(14,26,43,0.7)]">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-[var(--brand-slate)] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
