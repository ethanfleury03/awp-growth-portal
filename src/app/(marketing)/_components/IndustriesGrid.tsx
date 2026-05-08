import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import { getIndustryImage, type IndustrySlot } from './industry-images';
import { LeadModal } from './LeadModal';

interface Trade {
  slot: IndustrySlot;
  name: string;
  blurb: string;
  status: 'available' | 'planned';
}

const TRADES: Trade[] = [
  {
    slot: 'plumbing',
    name: 'Custom Cabin Buyers',
    blurb:
      'Capture land ownership, intended use, budget, timeline, site access, utilities, planning calls, proposal status, and follow-up timing.',
    status: 'available',
  },
  {
    slot: 'electrical',
    name: 'Realtor and Land-Broker Partners',
    blurb:
      'Organize referral relationships, partner education, buyer-guide assets, outreach status, and converted leads from land-buyer introductions.',
    status: 'available',
  },
  {
    slot: 'hvac',
    name: 'Campgrounds and Hospitality',
    blurb:
      'Track multi-unit opportunities, site layout questions, utility readiness, seasonal timing, decision makers, and proposal packages.',
    status: 'available',
  },
  {
    slot: 'roofing',
    name: 'STR and Second-Home Investors',
    blurb:
      'Keep investor conversations grounded in site constraints, layout goals, budget ranges, and compliant follow-up without making ROI promises.',
    status: 'available',
  },
  {
    slot: 'garage-door',
    name: 'Site-Prep Contractors',
    blurb:
      'Manage excavation, slab, septic, well, and access-road partners who can help cabin buyers move from interest to site-ready.',
    status: 'available',
  },
  {
    slot: 'pest-control',
    name: 'Marketing Assets',
    blurb:
      'Store brochures, buyer guides, proposal templates, case studies, FAQs, email templates, and campaign-specific content in one workspace.',
    status: 'available',
  },
  {
    slot: 'landscaping',
    name: 'Managed Client Workspaces',
    blurb:
      'Reuse the same CRM architecture for client-specific branding, module access, guardrails, data isolation, and reporting.',
    status: 'planned',
  },
];

export function IndustriesGrid() {
  return (
    <section className="bg-[var(--brand-cream)] py-20 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="trust-mark text-[var(--brand-orange-600)]">Use cases</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--brand-ink)]">
            One core CRM. Many cabin-growth workflows.
          </h2>
          <p className="mt-4 text-[var(--brand-slate-muted)] text-lg">
            WNY Automation Portal is configured around Adirondack White Pine Cabins today, with reusable
            architecture for buyer pipelines, partner outreach, estimates, reporting, and AI context.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((trade) => (
            <TradeCard key={trade.slot} trade={trade} />
          ))}
        </div>

        <p className="mt-10 text-sm text-[var(--brand-slate-muted)]">
          Don&apos;t see your workflow?{' '}
          <LeadModal
            kind="waitlist"
            title="Request a workflow"
            description="Tell us what you need to track and we'll follow up with a fit assessment."
            triggerLabel="Tell us what you need"
            triggerClassName="text-[var(--brand-orange-600)] font-semibold hover:underline"
            fields={['name', 'email', 'company', 'trade', 'message']}
          />
          {' '}— we prioritize by operational impact.
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
              Planned
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
              description="Leave your info and we'll reach out when this workflow is ready."
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
