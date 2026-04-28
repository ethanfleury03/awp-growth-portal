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
    title: 'AI Receptionist',
    body: 'Retell + Twilio voice, live transcription, emergency triage, and a mock mode for onboarding demos.',
  },
  {
    icon: KanbanSquare,
    title: 'Lead Inbox + Kanban',
    body: 'Drag-and-drop buckets: New → Qualified → Booked → Won. No more losing a job in a notebook.',
  },
  {
    icon: FileText,
    title: 'Estimates',
    body: 'Line items, multi-tier options, public approval links, e-signature, and PDF export.',
  },
  {
    icon: Receipt,
    title: 'Invoices + PDFs',
    body: 'Branded PDFs, bulk actions, customer-facing token view, status automation.',
  },
  {
    icon: CreditCard,
    title: 'Stripe Connect',
    body: 'Destination charges, deposits, refunds, disputes, and a live payments ledger per branch.',
  },
  {
    icon: MapPin,
    title: 'Dispatch Board',
    body: 'Map + schedule with drag-and-drop assignment, route suggestions, and ETA math.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Tech App',
    body: 'Job list, directions, status updates, signature capture, and photo uploads — built for gloves.',
  },
  {
    icon: PenTool,
    title: 'Signature Capture',
    body: 'Stored as a signed R2 attachment on every estimate — auditable, timestamped, and exportable.',
  },
  {
    icon: RefreshCcw,
    title: 'Service Contracts',
    body: 'Recurring maintenance plans that auto-generate jobs and invoices on the cadence you set.',
  },
  {
    icon: Paperclip,
    title: 'Attachments (R2)',
    body: 'Presigned Cloudflare R2 uploads for photos, docs, and signatures. Cheap, fast, yours.',
  },
  {
    icon: MessageSquare,
    title: 'SMS + Email',
    body: 'Transactional notifications with consent, STOP handling, and per-branch sender identities.',
  },
  {
    icon: Search,
    title: 'Global Search (⌘K)',
    body: 'Cmd-K jumps across customers, jobs, invoices, estimates, and leads in under 50ms.',
  },
  {
    icon: ShieldCheck,
    title: 'RBAC + Audit Log',
    body: 'Roles, scoped permissions, and a forensic audit trail for every sensitive action.',
  },
  {
    icon: BarChart3,
    title: 'Reports Dashboard',
    body: 'KPIs for invoices, payments, jobs, and leads. 7/30/90/365-day toggles, export-ready.',
  },
  {
    icon: Building2,
    title: 'Multi-branch + RLS',
    body: 'Postgres row-level security plus app-layer tenant guards — no data leaks between shops.',
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
            WNY Automation Portal replaces your answering service, CRM, scheduling app, invoicing tool, payment terminal,
            customer portal, and the homemade spreadsheet that held it all together.
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
          Plus: super-admin panel, feature flags, privacy export/delete, CSV import, Twilio inbound SMS, Inngest
          background jobs, Sentry, structured logging, Postgres + SQLite dual-driver, Clerk auth.
        </p>
      </div>
    </section>
  );
}
