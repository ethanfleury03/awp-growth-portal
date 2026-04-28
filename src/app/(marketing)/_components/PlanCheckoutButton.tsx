'use client';

import { useState } from 'react';

type BillingCycle = 'monthly' | 'annual';
type Plan = 'starter' | 'pro';

export function PlanCheckoutButton({
  plan,
  billingCycle,
  className,
  children,
}: {
  plan: Plan;
  billingCycle: BillingCycle;
  className?: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      document.cookie = `plan_preselected=${plan}; Path=/; Max-Age=604800; SameSite=Lax`;
      const res = await fetch('/api/marketing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || 'Could not start checkout.');
      }
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
        aria-busy={loading}
      >
        {loading ? 'Redirecting…' : children}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
