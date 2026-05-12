import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignUpClient } from '../sign-up-client';
import {
  getSafeRedirectPath,
  type RedirectSearchParams,
} from '@/lib/auth/redirect-after-sign-in';

function SignUpFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1422] text-white/70">Loading…</div>
  );
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<RedirectSearchParams>;
}) {
  const [{ userId }, sp] = await Promise.all([auth(), searchParams]);
  if (userId) redirect(getSafeRedirectPath(sp));

  return (
    <Suspense fallback={<SignUpFallback />}>
      <SignUpClient />
    </Suspense>
  );
}
