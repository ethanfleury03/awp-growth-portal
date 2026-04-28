import { PhoneIncoming, CalendarCheck2, Wallet } from 'lucide-react';

const VALUES = [
  {
    icon: PhoneIncoming,
    title: 'Every call becomes a job',
    body: 'The AI receptionist answers in seconds, books the right slot, and drops a structured lead into your pipeline — even at 11 PM on a Saturday.',
  },
  {
    icon: CalendarCheck2,
    title: 'Every job stays on schedule',
    body: 'Dispatch assigns the nearest tech, the mobile app tracks arrival, and customers get real-time ETA texts without anyone in the office.',
  },
  {
    icon: Wallet,
    title: 'Every invoice gets paid',
    body: 'Stripe Connect collects deposits, split payouts, refunds, and disputes. Ops sees the whole ledger. Techs just tap approve.',
  },
];

export function ValueStrip() {
  return (
    <section className="relative bg-[var(--brand-cream)] pt-36 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">Why operators switch</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Built for the three moments that actually move revenue.
          </h2>
          <p className="mt-4 text-[var(--brand-slate)] text-lg">
            Revenue leaks happen at handoff points: call to booking, booking to dispatch, and job closeout to
            payment. WNY Automation Portal is built around keeping each handoff clean.
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
