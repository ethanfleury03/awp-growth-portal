import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Password login is disabled. Sign in with Clerk at /login.',
    },
    { status: 410 },
  );
}
