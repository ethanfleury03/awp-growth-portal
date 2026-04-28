import { PhoneIncoming, KanbanSquare, Wrench, BadgeDollarSign, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    icon: PhoneIncoming,
    step: '01',
    title: 'Call comes in',
    body: 'AI receptionist answers, qualifies, books the slot, drops a structured lead.',
    bullets: ['Retell + Twilio voice', 'Emergency triage', 'Mock mode for demos'],
  },
  {
    icon: KanbanSquare,
    step: '02',
    title: 'Dispatch assigns a tech',
    body: 'Drag the job onto the board; the nearest tech gets the route + ETA math.',
    bullets: ['Map + schedule view', 'Drag-and-drop', 'Customer ETA texts'],
  },
  {
    icon: Wrench,
    step: '03',
    title: 'Tech works the job',
    body: 'Mobile app with status, signature, photos, and an on-the-spot estimate + invoice.',
    bullets: ['Built for gloves', 'Signature + photo upload', 'Offline-friendly'],
  },
  {
    icon: BadgeDollarSign,
    step: '04',
    title: 'Payment hits the bank',
    body: 'Stripe Connect settles the invoice; you see the payout, the fees, and the ledger.',
    bullets: ['Apple Pay + ACH', '2-day payouts', 'Unified ledger'],
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="py-24 bg-[var(--brand-cream)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-14">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Four steps from ringing phone to cleared payout.
          </h2>
          <p className="mt-4 text-lg text-[var(--brand-slate)]">
            Every handoff is auto-logged. Nothing lives in your head, a sticky note, or a spreadsheet.
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
