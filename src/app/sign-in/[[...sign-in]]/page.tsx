import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignInClient } from '../sign-in-client';
import {
  getSafeRedirectPath,
  type RedirectSearchParams,
} from '@/lib/auth/redirect-after-sign-in';

function SignInFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1422] text-white/70">Loading…</div>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<RedirectSearchParams>;
}) {
  const [{ userId }, sp] = await Promise.all([auth(), searchParams]);
  if (userId) redirect(getSafeRedirectPath(sp));

  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInClient />
    </Suspense>
  );
}
