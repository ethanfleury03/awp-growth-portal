import {
  Bot,
  KanbanSquare,
  FileText,
  Receipt,
  CreditCard,
  MapPin,
  Smartphone,
  PenTool,
  RefreshCcw,
  Paperclip,
  MessageSquare,
  Search,
  ShieldCheck,
  BarChart3,
  Building2,
} from 'lucide-react';

const TILES = [
  {
    icon: Bot,
    title: 'AI Growth Assistant',
    body: 'Answers with CRM-wide context: business profile, leads, customers, estimates, campaigns, assets, reports, and guardrails.',
  },
  {
    icon: KanbanSquare,
    title: 'Cabin Buyer Pipeline',
    body: 'Purpose-built stages from New Lead to Site Details Needed, Proposal Sent, Won, Lost, and Nurture.',
  },
  {
    icon: FileText,
    title: 'Estimates',
    body: 'Reusable catalog items, line-item proposals, public approval links, e-signature, deposits, and PDF export.',
  },
  {
    icon: Receipt,
    title: 'Invoices + PDFs',
    body: 'Customer-facing token views, branded PDFs, bulk actions, payment status, and clean follow-up workflows.',
  },
  {
    icon: CreditCard,
    title: 'Stripe Connect',
    body: 'Destination charges, deposits, refunds, disputes, and a live payments ledger per branch.',
  },
  {
    icon: MapPin,
    title: 'Site Readiness',
    body: 'Track land ownership, site access, utilities, slab/foundation needs, region, timeline, and buyer intent.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Workspace',
    body: 'Responsive CRM, customer history, proposal links, and activity context for sales and office staff.',
  },
  {
    icon: PenTool,
    title: 'Signature Capture',
    body: 'Stored as a signed R2 attachment on every estimate — auditable, timestamped, and exportable.',
  },
  {
    icon: RefreshCcw,
    title: 'Follow-Up Loops',
    body: 'Nurture leads, schedule next actions, and keep referrals, campaigns, and buyers from going stale.',
  },
  {
    icon: Paperclip,
    title: 'Attachments (R2)',
    body: 'Presigned Cloudflare R2 uploads for photos, docs, and signatures. Cheap, fast, yours.',
  },
  {
    icon: MessageSquare,
    title: 'SMS + Email',
    body: 'Transactional notifications with consent, STOP handling, and workspace-level sender configuration.',
  },
  {
    icon: Search,
    title: 'Global Search (⌘K)',
    body: 'Cmd-K jumps across customers, invoices, estimates, leads, and workspace records in under 50ms.',
  },
  {
    icon: ShieldCheck,
    title: 'RBAC + Audit Log',
    body: 'Roles, scoped permissions, and a forensic audit trail for every sensitive action.',
  },
  {
    icon: BarChart3,
    title: 'Reports Dashboard',
    body: 'Lead source, pipeline, campaign, estimate, invoice, and growth summaries built for owner review.',
  },
  {
    icon: Building2,
    title: 'Multi-branch + RLS',
    body: 'Postgres row-level security plus app-layer tenant guards — no data leaks between client workspaces.',
  },
];

export function FeatureGrid() {
  return (
    <section id="features-grid" className="py-24 bg-[var(--brand-cream-2)] relative">
      <div className="grid-dots absolute inset-0 opacity-60 pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-14">
          <span className="eyebrow">Everything in the box</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
            One platform instead of eight subscriptions.
          </h2>
          <p className="mt-4 text-lg text-[var(--brand-slate)]">
            WNY Automation Portal replaces the spreadsheet stack: lead tracker, customer notes, follow-up list,
            estimate catalog, outreach tracker, reporting doc, and AI prompt scratchpad.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TILES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="feature-tile">
              <span className="tile-icon">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-sm text-[var(--brand-slate)] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-[var(--brand-slate-muted)]">
          Plus: super-admin panel, feature flags, privacy export/delete, CSV import, inbound SMS, Inngest
          background jobs, Sentry, structured logging, Postgres + SQLite dual-driver, Clerk auth.
        </p>
      </div>
    </section>
  );
}
