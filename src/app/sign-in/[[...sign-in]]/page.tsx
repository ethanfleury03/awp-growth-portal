import { Suspense } from 'react';
import { SignInClient } from '../sign-in-client';

function SignInFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1422] text-white/70">Loading…</div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInClient />
    </Suspense>
  );
}
