import { Suspense } from 'react';
import { SignUpClient } from '../sign-up-client';

function SignUpFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1422] text-white/70">Loading…</div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpFallback />}>
      <SignUpClient />
    </Suspense>
  );
}
