import './marketing.css';
import { MarketingFooter } from './_components/MarketingFooter';
import { MarketingNav } from './_components/MarketingNav';

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="marketing-root min-h-screen bg-[var(--brand-cream)]">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
