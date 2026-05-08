import { PhoneIncoming, KanbanSquare, ClipboardCheck, BadgeDollarSign, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    icon: PhoneIncoming,
    step: '01',
    title: 'Inquiry comes in',
    body: 'A buyer, realtor, campground, or partner is captured with source, intent, budget, location, and context.',
    bullets: ['Website, phone, email, referral', 'Cabin-specific fields', 'AI summary'],
  },
  {
    icon: KanbanSquare,
    step: '02',
    title: 'Pipeline sets the next step',
    body: 'Move the opportunity through qualification, planning call, site details, proposal, won, lost, or nurture.',
    bullets: ['Drag-and-drop CRM', 'Follow-up timing', 'Pipeline reporting'],
  },
  {
    icon: ClipboardCheck,
    step: '03',
    title: 'Proposal gets prepared',
    body: 'Use customer history, site-readiness notes, catalog items, and guardrails to prepare a clean estimate.',
    bullets: ['Reusable catalog', 'Customer snapshots', 'Public approval link'],
  },
  {
    icon: BadgeDollarSign,
    step: '04',
    title: 'Follow-up stays organized',
    body: 'Invoices, payment links, campaign source, next action, and AI context stay tied to the same account.',
    bullets: ['Invoice tracking', 'Outreach context', 'Owner reporting'],
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="py-24 bg-[var(--brand-cream)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-14">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Four steps from raw inquiry to organized follow-up.
          </h2>
          <p className="mt-4 text-lg text-[var(--brand-slate)]">
            Every handoff is visible. Nothing lives only in someone&apos;s head, a sticky note, or a spreadsheet.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 relative">
          {STEPS.map(({ icon: Icon, step, title, body, bullets }, i) => (
            <div key={title} className="relative">
              <div className="brand-card-dark p-6 h-full">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold text-[var(--brand-orange-500)] tracking-[0.2em]">
                    STEP {step}
                  </span>
                  <span className="h-10 w-10 rounded-lg bg-[var(--brand-orange-500)]/15 text-[var(--brand-orange-500)] flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{body}</p>
                <ul className="mt-5 space-y-1.5">
                  {bullets.map((b) => (
                    <li key={b} className="text-xs text-white/60 flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-[var(--brand-orange-500)]" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-1/2 -right-4 -translate-y-1/2 text-[var(--brand-orange-500)] h-6 w-6" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
