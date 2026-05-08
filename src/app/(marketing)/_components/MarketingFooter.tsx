import Link from 'next/link';
import { Building2, Twitter, Linkedin, Github } from 'lucide-react';

const PRODUCT_LINKS = [
  { label: 'AI Assistant', href: '/features#spotlight-receptionist' },
  { label: 'Pipeline & Follow-Up', href: '/features#spotlight-dispatch' },
  { label: 'Estimates & Invoices', href: '/features#spotlight-payments' },
  { label: 'Customer Portal', href: '/features#spotlight-portal' },
  { label: 'Reports', href: '/features#features-grid' },
  { label: 'Pricing', href: '/pricing' },
];

function pickUrl(env: string | undefined, fallback: string): string {
  const v = env?.trim();
  return v || fallback;
}

function isExternalHref(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:');
}

export function MarketingFooter() {
  const twitter = process.env.NEXT_PUBLIC_SOCIAL_TWITTER?.trim();
  const linkedin = process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN?.trim();
  const github = process.env.NEXT_PUBLIC_SOCIAL_GITHUB?.trim();
  const hasSocial = Boolean(twitter || linkedin || github);

  const aboutHref = process.env.NEXT_PUBLIC_COMPANY_ABOUT_URL?.trim() || '/about';
  const blogHref = process.env.NEXT_PUBLIC_BLOG_URL?.trim();
  const careersHref = process.env.NEXT_PUBLIC_CAREERS_URL?.trim();

  const companyLinks: { label: string; href: string }[] = [
    { label: 'About', href: aboutHref },
    ...(blogHref ? [{ label: 'Blog', href: blogHref }] : []),
    ...(careersHref ? [{ label: 'Careers', href: careersHref }] : []),
    { label: 'Contact sales', href: '/contact' },
  ];

  const legalLinks = [
    { label: 'Terms of service', href: pickUrl(process.env.NEXT_PUBLIC_LEGAL_TERMS_URL, '/legal/terms') },
    { label: 'Privacy policy', href: pickUrl(process.env.NEXT_PUBLIC_LEGAL_PRIVACY_URL, '/legal/privacy') },
    { label: 'Cookie policy', href: pickUrl(process.env.NEXT_PUBLIC_LEGAL_COOKIES_URL, '/legal/cookies') },
    { label: 'DPA', href: pickUrl(process.env.NEXT_PUBLIC_LEGAL_DPA_URL, '/legal/dpa') },
    { label: 'Security', href: pickUrl(process.env.NEXT_PUBLIC_LEGAL_SECURITY_URL, '/legal/security') },
  ];

  return (
    <footer className="border-t border-white/8 bg-[linear-gradient(180deg,var(--brand-navy-900),var(--brand-navy-950))] text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 text-white">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-blue-500)] to-[var(--brand-blue-600)] text-white shadow-[0_14px_32px_-16px_rgba(37,76,137,0.72)]">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold tracking-tight">WNY Automation Portal</span>
            </Link>
            <p className="mt-4 text-sm max-w-sm leading-relaxed">
              A polished CRM workspace for cabin builders and growth teams. Organize leads, customers, estimates,
              outreach, reporting, and AI context in one secure portal.
            </p>
            {hasSocial ? (
              <div className="mt-6 flex items-center gap-3">
                {twitter ? (
                  <a
                    href={twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Twitter"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 hover:bg-white/5"
                  >
                    <Twitter className="h-4 w-4" />
                  </a>
                ) : null}
                {linkedin ? (
                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 hover:bg-white/5"
                  >
                    <Linkedin className="h-4 w-4" />
                  </a>
                ) : null}
                {github ? (
                  <a
                    href={github}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 hover:bg-white/5"
                  >
                    <Github className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              {companyLinks.map((l) => (
                <li key={l.label}>
                  {isExternalHref(l.href) ? (
                    <a
                      href={l.href}
                      className="hover:text-white transition-colors"
                      {...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              {legalLinks.map((l) => (
                <li key={l.label}>
                  {isExternalHref(l.href) ? (
                    <a
                      href={l.href}
                      className="hover:text-white transition-colors"
                      {...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} WNY Automation Portal, Inc. All rights reserved.
          </p>
          <p className="text-xs text-white/50">Made for operators who need clean handoffs and accountable follow-up.</p>
        </div>
      </div>
    </footer>
  );
}
