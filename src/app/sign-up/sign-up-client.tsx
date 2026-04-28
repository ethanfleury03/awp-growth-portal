'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignUp } from '@clerk/nextjs';
import { AuthMarketingShell } from '@/components/auth/auth-marketing-shell';
import { clerkMarketingAppearance } from '@/components/auth/clerk-marketing-appearance';
import { getSafeRedirectPath } from '@/lib/auth/redirect-after-sign-in';

export function SignUpClient() {
  const sp = useSearchParams();
  const redirectTo = useMemo(() => getSafeRedirectPath(sp), [sp]);

  return (
    <AuthMarketingShell subtitle="Create your account">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={redirectTo}
        signInForceRedirectUrl={redirectTo}
        appearance={clerkMarketingAppearance}
      />
    </AuthMarketingShell>
  );
}
