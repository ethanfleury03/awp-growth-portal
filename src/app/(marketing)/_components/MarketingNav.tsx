'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Menu, X, Wrench } from 'lucide-react';

const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Features', href: '/features' },
  { label: 'Industries', href: '/industries' },
  { label: 'Pricing', href: '/pricing' },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const { isLoaded, isSignedIn } = useAuth();
  const showSignedIn = isLoaded && isSignedIn;
  const showSignedOut = isLoaded && !isSignedIn;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const toggleEl = toggleRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
      if (event.key !== 'Tab') return;
      const root = menuRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    const firstFocusable = menuRef.current?.querySelector<HTMLElement>('a[href], button');
    firstFocusable?.focus();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      toggleEl?.focus();
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 brand-gradient-nav border-b border-white/10 transition-shadow duration-300 ${
        scrolled ? 'shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)]' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 text-white">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-blue-500)] to-[var(--brand-blue-600)] text-white shadow-[0_14px_32px_-16px_rgba(37,76,137,0.72)]">
              <Wrench className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">WNY Automation Portal</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-white/68 hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {showSignedOut && (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-semibold text-white/80 hover:text-white px-3 py-2"
                >
                  Sign in
                </Link>
                <Link href="/sign-up" className="btn-primary text-sm">
                  Start free trial
                </Link>
              </>
            )}
            {showSignedIn && (
              <Link
                href="/app"
                className="btn-primary text-sm"
                aria-label="Open the WNY Automation Portal app"
              >
                Open app
              </Link>
            )}
          </div>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 text-white"
            aria-label="Toggle navigation"
            aria-expanded={open}
            aria-controls="marketing-mobile-nav"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="marketing-mobile-nav"
          ref={menuRef}
          className="md:hidden border-t border-white/10 bg-[rgba(8,17,29,0.96)] backdrop-blur-xl"
        >
          <div className="px-6 py-4 space-y-3">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block text-base font-medium text-white/80"
              >
                {l.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              {showSignedOut && (
                <>
                  <Link
                    href="/sign-in"
                    className="text-center text-sm font-semibold text-white/80 py-2"
                  >
                    Sign in
                  </Link>
                  <Link href="/sign-up" className="btn-primary text-sm">
                    Start free trial
                  </Link>
                </>
              )}
              {showSignedIn && (
                <Link href="/app" className="btn-primary text-sm">
                  Open app
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
