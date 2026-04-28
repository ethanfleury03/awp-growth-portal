'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignIn } from '@clerk/nextjs';
import { AuthMarketingShell } from '@/components/auth/auth-marketing-shell';
import { clerkMarketingAppearance } from '@/components/auth/clerk-marketing-appearance';
import { getSafeRedirectPath } from '@/lib/auth/redirect-after-sign-in';

export function SignInClient() {
  const sp = useSearchParams();
  const redirectTo = useMemo(() => getSafeRedirectPath(sp), [sp]);

  return (
    <AuthMarketingShell subtitle="Sign in to continue">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl={redirectTo}
        signUpForceRedirectUrl={redirectTo}
        appearance={clerkMarketingAppearance}
      />
    </AuthMarketingShell>
  );
}
