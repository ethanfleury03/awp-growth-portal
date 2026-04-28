import Link from 'next/link';
import { Show } from '@clerk/nextjs';
import { ArrowRight, PhoneCall } from 'lucide-react';
import { LeadModal } from './LeadModal';

export function CTABanner() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 brand-hero-bg" />
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.9) 1.2px, transparent 1.2px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
        <span className="glow-pill glow-pill-dark">
          <PhoneCall className="h-3.5 w-3.5" />
          Let&apos;s run the numbers on your shop
        </span>
        <h2 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          Stop losing jobs to voicemail.
          <br />
          <span className="text-[var(--brand-orange-500)]">Start running the shop like it&apos;s 2026.</span>
        </h2>
        <p className="mt-6 text-lg text-white/75 max-w-2xl mx-auto">
          Spin up a free 14-day trial or book a 20-minute demo with a former dispatcher on our team. We&apos;ll
          import your customers and get you live on your next ringing phone.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Show when="signed-out">
            <Link href="/sign-up" className="btn-primary text-base">
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <LeadModal
              kind="demo"
              title="Book a demo"
              description="Tell us about your shop and we'll follow up with a tailored walkthrough."
              triggerLabel="Book a demo"
              triggerClassName="btn-ghost text-base"
              fields={['name', 'email', 'company', 'phone', 'message']}
            />
          </Show>
          <Show when="signed-in">
            <Link href="/app" className="btn-primary text-base">
              Open your dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <LeadModal
              kind="contact"
              title="Talk to sales"
              description="We can help with rollout planning, migration, and team onboarding."
              triggerLabel="Talk to sales"
              triggerClassName="btn-ghost text-base"
              fields={['name', 'email', 'company', 'phone', 'message']}
            />
          </Show>
        </div>
        <p className="mt-4 text-xs text-white/50">
          No credit card required. Cancel anytime. We never sell your data.
        </p>
      </div>
    </section>
  );
}
