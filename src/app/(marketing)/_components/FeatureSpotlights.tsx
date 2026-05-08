import { FeatureSpotlight } from './FeatureSpotlight';
import { BrowserFrame, PhoneFrame } from './BrowserFrame';
import { getLandingImage } from './landing-images';

function ReceptionistMockup() {
  return (
    <div className="hidden md:block absolute -left-10 bottom-8 w-80">
      <BrowserFrame url="portal.wnyautomation.com/crm">
        <div className="p-4 text-[var(--brand-ink)] bg-white">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Qualified</span>
            <span className="ml-auto text-xs text-[var(--brand-slate-muted)]">New inquiry</span>
          </div>
          <p className="text-xs font-semibold text-[var(--brand-slate-muted)] mb-1">AI summary</p>
          <div className="space-y-2 text-sm">
            <div className="bg-slate-50 rounded-md p-2">
              <b className="text-[var(--brand-orange-600)]">Buyer:</b> Wants a four-season cabin near Lake Placid.
            </div>
            <div className="bg-slate-50 rounded-md p-2">
              <b>Site:</b> Land owned, access unknown, utilities need confirmation.
            </div>
            <div className="rounded-md border border-[var(--brand-blue-500)]/25 bg-[var(--brand-blue-500)]/10 p-2">
              <b className="text-[var(--brand-blue-600)]">Next:</b> Planning call around layout, budget, and delivery path.
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Type: homeowner
            </span>
            <span className="text-[var(--brand-slate-muted)]">Score: 78</span>
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
            <span className="text-xs font-semibold">Lead details</span>
            <span className="text-xs text-emerald-600 font-semibold">Updated</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 mb-2">
            <p className="text-xs text-[var(--brand-slate-muted)]">Site readiness</p>
            <p className="text-sm font-bold">Lake Placid parcel</p>
            <p className="text-xs text-[var(--brand-slate-muted)]">Access road and utilities need review</p>
            <div className="mt-2 flex gap-1.5">
              <span className="text-[10px] bg-red-50 text-red-700 font-semibold px-1.5 py-0.5 rounded">
                Site access
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded">
                Utilities
              </span>
            </div>
          </div>
          <div className="w-full rounded-lg bg-[var(--brand-blue-500)] py-2.5 text-center text-sm font-semibold text-white">
            Planning call scheduled
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}

function PaymentsMockup() {
  return (
    <div className="hidden md:block absolute -left-8 -bottom-10 w-80">
      <BrowserFrame url="portal.wnyautomation.com/estimates">
        <div className="p-5 bg-white text-[var(--brand-ink)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--brand-slate-muted)]">Estimate package</p>
              <p className="font-bold text-xl">Ready for review</p>
            </div>
            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
              SENT
            </span>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ['Design consultation', '$0.00'],
              ['Site-readiness review', '$0.00'],
              ['Custom cabin proposal', 'TBD'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="text-[var(--brand-slate)]">{l}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[var(--brand-slate-muted)]">Public approval link ready</span>
            <span className="text-[var(--brand-slate-muted)]">Follow-up queued</span>
          </div>
        </div>
      </BrowserFrame>
    </div>
  );
}

function PortalMockup() {
  return (
    <div className="hidden md:block absolute -right-6 -top-8 w-72">
      <BrowserFrame url="portal.wnyautomation.com/customer">
        <div className="p-5 bg-white text-[var(--brand-ink)]">
          <p className="text-xs text-[var(--brand-slate-muted)]">Customer portal</p>
          <p className="font-bold mt-1">Your cabin proposal</p>
          <div className="mt-3 p-3 rounded-lg bg-[var(--brand-cream)] border border-slate-200">
            <p className="text-sm font-bold">Planning call complete</p>
            <p className="text-xs text-[var(--brand-slate-muted)]">Site details and estimate summary attached</p>
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
        eyebrow="AI Assistant"
        title={
          <>
            Give the AI <span className="orange-underline">the same context</span> your team has.
          </>
        }
        body="The assistant can reference the business profile, buyer pipeline, customers, estimates, invoices, campaigns, assets, reports, and knowledge items while staying inside explicit guardrails."
        bullets={[
          'Structured context explains the cabin offer, region, differentiators, and claims the AI must not invent.',
          'CRM summaries include lead type, source, intended use, land ownership, site access, utilities, and budget.',
          'Growth records give the assistant campaign, asset, SEO, report, and outreach context.',
        ]}
        image={getLandingImage('receptionist')}
        variant="soft"
        mockup={<ReceptionistMockup />}
      />

      <FeatureSpotlight
        id="spotlight-dispatch"
        eyebrow="Pipeline + Follow-Up"
        title={
          <>
            The spreadsheet, but every buyer has a next step.
          </>
        }
        body="Move buyers through the cabin-specific pipeline and keep planning calls, site constraints, estimate needs, and nurture timing visible."
        bullets={[
          'Stages match the real cabin sales process, not a generic task board.',
          'Lead details capture site access, utilities, intended use, budget, and buyer type.',
          'Owner dashboard and reports summarize active pipeline, follow-ups, and source quality.',
        ]}
        image={getLandingImage('dispatch')}
        reverse
        variant="dark"
        mockup={<DispatchMockup />}
      />

      <FeatureSpotlight
        id="spotlight-payments"
        eyebrow="Estimates → Invoices"
        title={
          <>
            From planning call to <span className="orange-underline">proposal-ready</span> in one thread.
          </>
        }
        body="Build a line-item estimate from reusable catalog items, send a branded approval link, capture signatures, convert to invoice, and keep payment settings clear."
        bullets={[
          'Stripe Connect support for deposits, refunds, disputes, and payout tracking.',
          'Customer-facing estimate + invoice links with e-signature and token-authed portal.',
          'PDF export, bulk invoice actions, and a unified ledger tied to customer records.',
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
        body="Every customer gets a private portal to review estimates, invoices, signed documents, and shared project context. Less scattered texting. More organized follow-through."
        bullets={[
          'Token-authed portal — no passwords, just a magic link from the invoice.',
          'Central place for estimate approvals, invoices, documents, and status context.',
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
              'AI assistant: answers with CRM and growth context.',
              'Pipeline: tracks buyer type, site readiness, budget, and follow-up.',
              'Estimates + invoices: send, sign, approve, and collect online.',
              'Customer portal: share proposal and account history from one secure link.',
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
