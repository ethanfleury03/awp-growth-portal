import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import { getIndustryImage, type IndustrySlot } from './industry-images';
import { LeadModal } from './LeadModal';

interface Trade {
  slot: IndustrySlot;
  name: string;
  blurb: string;
  status: 'available' | 'coming-soon';
}

const TRADES: Trade[] = [
  {
    slot: 'plumbing',
    name: 'Plumbing',
    blurb:
      'Purpose-built from day one. Call capture for water heaters, leaks, and drain emergencies; dispatch tuned around service-area radius and parts on the truck.',
    status: 'available',
  },
  {
    slot: 'electrical',
    name: 'Electrical',
    blurb:
      'Panel upgrades, EV chargers, and emergency calls — with permit tracking, inspection reminders, and load-calc attachments on every estimate.',
    status: 'coming-soon',
  },
  {
    slot: 'hvac',
    name: 'HVAC',
    blurb:
      'Seasonal maintenance plans, multi-visit jobs, and replacement quotes with equipment spec sheets and financing built into the customer portal.',
    status: 'coming-soon',
  },
  {
    slot: 'roofing',
    name: 'Roofing',
    blurb:
      'Storm-surge scheduling, insurance-claim workflows, and photo-first job folders that survive the back-and-forth with adjusters.',
    status: 'coming-soon',
  },
  {
    slot: 'garage-door',
    name: 'Garage Door',
    blurb:
      'Spring-break emergencies and opener installs, with SKU-level parts lookup and same-day invoicing built for one-and-done service calls.',
    status: 'coming-soon',
  },
  {
    slot: 'pest-control',
    name: 'Pest Control',
    blurb:
      'Recurring route optimization, chemical logs, and re-treatment guarantees tied to customer profiles and automated follow-up messaging.',
    status: 'coming-soon',
  },
  {
    slot: 'landscaping',
    name: 'Landscaping',
    blurb:
      'Weekly mow routes, seasonal programs, and project bids side-by-side — with weather-aware scheduling and crew-time tracking.',
    status: 'coming-soon',
  },
];

export function IndustriesGrid() {
  return (
    <section className="bg-[var(--brand-cream)] py-20 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="trust-mark text-[var(--brand-orange-600)]">Industries</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--brand-ink)]">
            One core. Many trades.
          </h2>
          <p className="mt-4 text-[var(--brand-slate-muted)] text-lg">
            WNY Automation Portal ships today for plumbing shops. The trades below are on the
            roadmap — join the waitlist and we&apos;ll onboard you the week we
            turn your vertical on.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((trade) => (
            <TradeCard key={trade.slot} trade={trade} />
          ))}
        </div>

        <p className="mt-10 text-sm text-[var(--brand-slate-muted)]">
          Don&apos;t see your trade?{' '}
          <LeadModal
            kind="waitlist"
            title="Request your trade"
            description="Tell us what you run and we'll notify you when support opens."
            triggerLabel="Tell us what you run"
            triggerClassName="text-[var(--brand-orange-600)] font-semibold hover:underline"
            fields={['name', 'email', 'company', 'trade', 'message']}
          />
          {' '}— we prioritize by demand.
        </p>
      </div>
    </section>
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  const img = getIndustryImage(trade.slot);
  const isAvailable = trade.status === 'available';
  return (
    <article
      className={`group brand-card overflow-hidden flex flex-col transition-transform duration-300 hover:-translate-y-1 ${
        isAvailable ? 'ring-1 ring-[var(--brand-orange-500)]/40' : ''
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--brand-navy-900)]">
        <Image
          src={img.src}
          alt={img.alt}
          width={img.width}
          height={img.height}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute top-3 left-3">
          {isAvailable ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-[var(--brand-orange-500)] text-white px-2.5 py-1 rounded-full shadow">
              <CheckCircle2 className="h-3 w-3" />
              Available today
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/90 text-[var(--brand-ink)] px-2.5 py-1 rounded-full shadow">
              <Clock3 className="h-3 w-3" />
              Coming soon
            </span>
          )}
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-xl font-bold text-[var(--brand-ink)]">{trade.name}</h3>
        <p className="mt-2 text-sm text-[var(--brand-slate-muted)] leading-relaxed flex-1">
          {trade.blurb}
        </p>
        <div className="mt-5">
          {isAvailable ? (
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-orange-600)] hover:text-[var(--brand-orange-500)]"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <LeadModal
              kind="waitlist"
              title={`${trade.name} waitlist`}
              description="Leave your info and we'll reach out when this vertical opens."
              triggerLabel="Join the waitlist"
              triggerClassName="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-ink)] hover:text-[var(--brand-orange-600)]"
              defaultTrade={trade.name}
              fields={['name', 'email', 'company', 'trade', 'message']}
            />
          )}
        </div>
      </div>
    </article>
  );
}
