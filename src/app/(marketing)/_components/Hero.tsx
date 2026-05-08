import Link from 'next/link';
import Image from 'next/image';
import { Show } from '@clerk/nextjs';
import { ArrowRight, CheckCircle2, ClipboardCheck, Sparkles, Clock3 } from 'lucide-react';
import { BrowserFrame } from './BrowserFrame';
import { getLandingImage } from './landing-images';

export function Hero() {
  const hero = getLandingImage('hero');

  return (
    <section className="brand-hero-bg relative overflow-hidden -mt-16 pt-16">
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(90deg, transparent 49.5%, rgba(255,255,255,0.6) 49.5% 50.5%, transparent 50.5%), linear-gradient(0deg, transparent 49.5%, rgba(255,255,255,0.6) 49.5% 50.5%, transparent 50.5%)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 text-white fade-up">
            <span className="glow-pill glow-pill-dark">
              <Sparkles className="h-3.5 w-3.5" />
              Cabin CRM · Estimates · AI context
            </span>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight text-white">
              Run every cabin buyer conversation from{' '}
              <span className="text-[var(--brand-orange-500)]">one workspace</span>.
            </h1>

            <p className="mt-6 text-lg text-white/75 max-w-xl leading-relaxed">
              WNY Automation Portal gives custom cabin builders a polished CRM for leads, customers, site-readiness
              details, estimates, outreach, reporting, and an AI assistant that understands the whole account.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Show when="signed-out">
                <Link href="/sign-up" className="btn-primary">
                  Start free 14-day trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/features#workflow" className="btn-ghost">
                  See how it works
                </Link>
              </Show>
              <Show when="signed-in">
                <Link href="/app" className="btn-primary">
                  Open your dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/features" className="btn-ghost">
                  Explore features
                </Link>
              </Show>
            </div>

            <ul className="mt-8 grid grid-cols-2 gap-y-2 gap-x-6 text-sm text-white/70 max-w-md">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--brand-orange-500)]" />
                Cabin-specific pipeline
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--brand-orange-500)]" />
                AI with CRM context
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--brand-orange-500)]" />
                Estimate workflow
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--brand-orange-500)]" />
                Outreach and reporting
              </li>
            </ul>
          </div>

          <div className="lg:col-span-6 relative fade-up" style={{ animationDelay: '120ms' }}>
            <div className="relative">
              <Image
                src={hero.src}
                alt={hero.alt}
                width={hero.width}
                height={hero.height}
                priority
                sizes="(min-width: 1024px) 48vw, 100vw"
                className="h-auto w-full rounded-[28px] border border-white/10 object-cover shadow-[0_40px_80px_-30px_rgba(0,0,0,0.62)]"
              />

              <div className="hidden sm:block absolute -left-10 top-10 w-72 brand-card p-4 text-[var(--brand-ink)]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--brand-orange-600)]">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  New buyer inquiry
                </div>
                <p className="mt-2 text-sm font-semibold">Lake Placid second-home cabin</p>
                <p className="text-xs text-[var(--brand-slate-muted)] leading-snug mt-1">
                  &ldquo;Owns land, needs site-access review, target budget $300k-$400k.&rdquo;
                </p>
                <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-[var(--brand-blue-500)] px-2 py-1 text-[11px] font-semibold text-white">
                  Routed to planning call
                </div>
              </div>

              <div className="hidden sm:block absolute -right-8 -bottom-8 w-72 brand-card p-4 text-[var(--brand-ink)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--brand-slate-muted)]">Proposal status</span>
                  <span className="text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                    READY
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold">Estimate prepared</p>
                <div className="flex items-center gap-1 text-xs text-[var(--brand-slate-muted)] mt-1">
                  <Clock3 className="h-3 w-3" /> Customer history, notes, and site details attached
                </div>
                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-r from-[var(--brand-blue-500)] to-[var(--brand-blue-600)]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden mt-10 grid gap-3">
          {[
            'AI assistant answers with live CRM context.',
            'Pipeline stages match the cabin sales process.',
            'Estimates, outreach, and reports stay connected.',
          ].map((line) => (
            <div key={line} className="brand-card p-3.5 text-sm text-[var(--brand-ink)]">
              {line}
            </div>
          ))}
        </div>

        <div className="mt-16 pt-10 border-t border-white/10 text-center">
          <p className="trust-mark text-white/60">
            Built for Adirondack White Pine Cabins and reusable for serious client workspaces.
          </p>
        </div>
      </div>

      <div className="brand-hairline h-0.5 w-full opacity-70" />

      <BrowserFrameMock />
    </section>
  );
}

function BrowserFrameMock() {
  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mb-20 -mt-8 hidden md:block">
      <BrowserFrame url="portal.wnyautomation.com/app">
        <div className="grid grid-cols-12 h-[360px]">
          <aside className="col-span-3 bg-[var(--brand-navy-900)] text-white/80 p-5">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-6 w-6 rounded-md bg-[var(--brand-blue-500)]" />
              <span className="font-bold tracking-tight">WNY Automation Portal</span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {[
                ['Dashboard', true],
                ['CRM', false],
                ['Customers', false],
                ['Estimates', false],
                ['Invoices', false],
                ['Outreach', false],
                ['AI Assistant', false],
                ['Reports', false],
              ].map(([label, active]) => (
                <li
                  key={String(label)}
                  className={`rounded-md px-3 py-1.5 ${active ? 'bg-white/10 text-white' : 'text-white/60'}`}
                >
                  {String(label)}
                </li>
              ))}
            </ul>
          </aside>
          <div className="col-span-9 p-6 bg-[var(--brand-cream)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-[var(--brand-ink)]">Cabin buyer workspace</h3>
                <p className="text-xs text-[var(--brand-slate-muted)]">
                  Leads, customers, site readiness, outreach, and proposals in one place
                </p>
              </div>
              <div className="hidden sm:flex gap-2">
                <div className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-md">
                  This week
                </div>
                <div className="rounded-md bg-[var(--brand-blue-500)] px-3 py-1.5 text-xs font-semibold text-white">
                  New lead
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                ['Leads', '48', '12 active'],
                ['Qualified', '16', 'site-ready'],
                ['Estimates', '$842k', 'pipeline value'],
                ['Campaigns', '9', 'in motion'],
              ].map(([label, value, sub]) => (
                <div key={label as string} className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-[11px] text-[var(--brand-slate-muted)]">{label as string}</div>
                  <div className="font-bold text-[var(--brand-ink)] text-lg">{value as string}</div>
                  <div className="text-[10px] text-[var(--brand-blue-600)]">{sub as string}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-100 text-xs font-semibold text-[var(--brand-slate-muted)]">
                Recent leads
              </div>
              <ul className="divide-y divide-slate-100 text-sm">
                {[
                  ['Second-home cabin', 'Lake Placid buyer', 'Planning call', 'bg-emerald-50 text-emerald-700'],
                  ['Campground expansion', 'Multi-unit rental cabins', 'Qualified', 'bg-amber-50 text-amber-700'],
                  ['Realtor partner', 'Land-buyer referrals', 'Contacted', 'bg-sky-50 text-sky-700'],
                ].map(([name, issue, status, cls]) => (
                  <li key={name as string} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--brand-ink)]">{name as string}</div>
                      <div className="text-xs text-[var(--brand-slate-muted)]">{issue as string}</div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls as string}`}>
                      {status as string}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </BrowserFrame>
    </div>
  );
}
