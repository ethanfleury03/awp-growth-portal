import { Sparkles } from 'lucide-react';

export function IndustriesHero() {
  return (
    <section className="brand-hero-bg relative overflow-hidden -mt-16 pt-16">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(90deg, transparent 49.5%, rgba(255,255,255,0.6) 49.5% 50.5%, transparent 50.5%), linear-gradient(0deg, transparent 49.5%, rgba(255,255,255,0.6) 49.5% 50.5%, transparent 50.5%)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-20 md:pb-24 text-center">
        <span className="glow-pill glow-pill-dark">
          <Sparkles className="h-3.5 w-3.5" />
          One platform · Every trade
        </span>
        <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight text-white">
          Built for plumbers.{' '}
          <span className="text-[var(--brand-orange-500)]">Ready for every trade.</span>
        </h1>
        <p className="mt-6 text-lg text-white/75 max-w-2xl mx-auto leading-relaxed">
          Plumbing is where we started and where we&apos;re deepest — but the same
          operating system that captures calls, dispatches techs, and collects
          payment works for every home-services trade. Here&apos;s where we are today.
        </p>
      </div>

      <div className="brand-hairline h-0.5 w-full opacity-70" />
    </section>
  );
}
