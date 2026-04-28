import { NextResponse } from 'next/server';
import { getPortalUser } from '@/lib/auth/portal-user';
import type { MeResponse } from '@/lib/auth/types';

export async function GET() {
  try {
    const user = await getPortalUser();
    if (!user) {
      return NextResponse.json({ authenticated: false } satisfies MeResponse);
    }
    return NextResponse.json({ authenticated: true, user } satisfies MeResponse);
  } catch (e) {
    console.error('[auth/me]', e);
    return NextResponse.json({ authenticated: false } satisfies MeResponse);
  }
}
