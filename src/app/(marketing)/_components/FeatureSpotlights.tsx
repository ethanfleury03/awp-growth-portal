import { FeatureSpotlight } from './FeatureSpotlight';
import { BrowserFrame, PhoneFrame } from './BrowserFrame';
import { getLandingImage } from './landing-images';

function ReceptionistMockup() {
  return (
    <div className="hidden md:block absolute -left-10 bottom-8 w-80">
      <BrowserFrame url="app.plumber.os/receptionist">
        <div className="p-4 text-[var(--brand-ink)] bg-white">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-red-500">Live</span>
            <span className="ml-auto text-xs text-[var(--brand-slate-muted)]">00:47</span>
          </div>
          <p className="text-xs font-semibold text-[var(--brand-slate-muted)] mb-1">Transcript</p>
          <div className="space-y-2 text-sm">
            <div className="bg-slate-50 rounded-md p-2">
              <b className="text-[var(--brand-orange-600)]">AI:</b> Hi, this is your service desk. How can I help?
            </div>
            <div className="bg-slate-50 rounded-md p-2">
              <b>Caller:</b> We have a water heater leak in the basement. Can someone come today?
            </div>
            <div className="rounded-md border border-[var(--brand-blue-500)]/25 bg-[var(--brand-blue-500)]/10 p-2">
              <b className="text-[var(--brand-blue-600)]">AI:</b> I can get a tech out between 2–4 PM. Address?
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Intent: book_service
            </span>
            <span className="text-[var(--brand-slate-muted)]">Priority: emergency</span>
          </div>
        </div>
      </BrowserFrame>
    </div>
  );
}

function DispatchMockup() {
  return (
    <div className="hidden md:block absolute -right-8 -bottom-10 w-60">
      <PhoneFrame>
        <div className="bg-[var(--brand-cream)] p-4 text-[var(--brand-ink)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold">Tue, 2:14 PM</span>
            <span className="text-xs text-emerald-600 font-semibold">On route</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 mb-2">
            <p className="text-xs text-[var(--brand-slate-muted)]">Next stop</p>
            <p className="text-sm font-bold">Emergency leak · 14 Elm St</p>
            <p className="text-xs text-[var(--brand-slate-muted)]">Water heater — emergency</p>
            <div className="mt-2 flex gap-1.5">
              <span className="text-[10px] bg-red-50 text-red-700 font-semibold px-1.5 py-0.5 rounded">
                Leak
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded">
                2–4 PM
              </span>
            </div>
          </div>
          <div className="w-full rounded-lg bg-[var(--brand-blue-500)] py-2.5 text-center text-sm font-semibold text-white">
            Arrival status synced
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}

function PaymentsMockup() {
  return (
    <div className="hidden md:block absolute -left-8 -bottom-10 w-80">
      <BrowserFrame url="app.plumber.os/invoices">
        <div className="p-5 bg-white text-[var(--brand-ink)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--brand-slate-muted)]">Invoice payment</p>
              <p className="font-bold text-xl">Collected online</p>
            </div>
            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
              PAID
            </span>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ['Water heater replace (40 gal)', '$980.00'],
              ['Emergency after-hours service', '$180.00'],
              ['Permit + haul-away', '$124.00'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="text-[var(--brand-slate)]">{l}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[var(--brand-slate-muted)]">Collected via Stripe · Visa ••4512</span>
            <span className="text-[var(--brand-slate-muted)]">Payout in 2 days</span>
          </div>
        </div>
      </BrowserFrame>
    </div>
  );
}

function PortalMockup() {
  return (
    <div className="hidden md:block absolute -right-6 -top-8 w-72">
      <BrowserFrame url="portal.plumber.os/customer">
        <div className="p-5 bg-white text-[var(--brand-ink)]">
          <p className="text-xs text-[var(--brand-slate-muted)]">Customer portal</p>
          <p className="font-bold mt-1">Your upcoming visit</p>
          <div className="mt-3 p-3 rounded-lg bg-[var(--brand-cream)] border border-slate-200">
            <p className="text-sm font-bold">Thursday · 2–4 PM window</p>
            <p className="text-xs text-[var(--brand-slate-muted)]">Tech: Assigned crew member</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-center">
            <div className="bg-slate-100 py-1.5 rounded">Reschedule</div>
            <div className="bg-slate-100 py-1.5 rounded">Cancel</div>
            <div className="rounded bg-[var(--brand-blue-500)] py-1.5 text-white">Message</div>
          </div>
        </div>
      </BrowserFrame>
    </div>
  );
}

export function FeatureSpotlights() {
  return (
    <>
      <FeatureSpotlight
        id="spotlight-receptionist"
        eyebrow="AI Receptionist"
        title={
          <>
            Pick up <span className="orange-underline">every single call</span> — without hiring a front desk.
          </>
        }
        body="Powered by Retell + Twilio with a safety net of human-readable transcripts, emergency flagging, and mock mode for demos. Your AI receptionist qualifies the lead, books the slot, and hands a clean job card to dispatch."
        bullets={[
          'Answers 24/7 in a voice that matches your brand — no robotic hold music.',
          'Structured leads land in the pipeline with customer, issue, priority, and booking preferences.',
          'Emergency detection escalates leaks and shutoffs to on-call in under 30 seconds.',
        ]}
        image={getLandingImage('receptionist')}
        variant="soft"
        mockup={<ReceptionistMockup />}
      />

      <FeatureSpotlight
        id="spotlight-dispatch"
        eyebrow="Dispatch + Mobile"
        title={
          <>
            The whiteboard, but your techs can see it from the truck.
          </>
        }
        body="Your dispatcher drags jobs across the day; your techs see them on the mobile app. Every status change, photo, and note lands on one timeline — no more three-way text threads about 'where are you?'."
        bullets={[
          'Map-aware dispatch board with drag-and-drop, route optimization, and ETA math.',
          'Mobile tech view with job details, status, signature capture, and photo uploads.',
          'Automatic customer text updates for on-the-way, delayed, and completed.',
        ]}
        image={getLandingImage('dispatch')}
        reverse
        variant="dark"
        mockup={<DispatchMockup />}
      />

      <FeatureSpotlight
        id="spotlight-payments"
        eyebrow="Estimates → Payments"
        title={
          <>
            From quote to <span className="orange-underline">paid-in-full</span> in one thread.
          </>
        }
        body="Build a line-item estimate on the truck, send it as a branded link, take the signature, convert to invoice, and collect by Apple Pay or ACH. Stripe Connect keeps deposits, refunds, disputes, and payouts on rails."
        bullets={[
          'Stripe Connect destination charges with multi-branch payouts and clean 1099-K reporting.',
          'Customer-facing estimate + invoice links with e-signature and token-authed portal.',
          'Deposits, bulk actions, PDF export, and a unified payments ledger tied to every job.',
        ]}
        image={getLandingImage('payments')}
        mockup={<PaymentsMockup />}
      />

      <FeatureSpotlight
        id="spotlight-portal"
        eyebrow="Customer Portal"
        title={
          <>
            Give homeowners a front door that isn&apos;t your cell phone.
          </>
        }
        body="Every customer gets a private portal to see upcoming visits, past invoices, estimates, signed documents, and warranty info. Less answering texts after dinner. More repeat bookings."
        bullets={[
          'Token-authed portal — no passwords, just a magic link from the invoice.',
          'Self-serve reschedule, message-your-tech, and one-click re-book for annual services.',
          'SMS + email notifications with consent tracking and full STOP keyword compliance.',
        ]}
        image={getLandingImage('portal')}
        reverse
        variant="soft"
        mockup={<PortalMockup />}
      />

      <section className="md:hidden px-4 pb-10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-3">
            {[
              'AI receptionist: captures caller intent and booking windows.',
              'Dispatch + mobile: crew status sync with customer ETAs.',
              'Estimates + payments: send, sign, invoice, and collect online.',
              'Customer portal: reschedule, message, and view service history.',
            ].map((line) => (
              <div key={line} className="brand-card p-3.5 text-sm text-[var(--brand-ink)]">
                {line}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
