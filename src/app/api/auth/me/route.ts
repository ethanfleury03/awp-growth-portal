import { NextResponse } from 'next/server';
import { getPortalUser } from '@/lib/auth/portal-user';
import type { MeResponse } from '@/lib/auth/types';
import { getCompanyWorkspace } from '@/lib/workspace/workspace';

export async function GET() {
  try {
    const user = await getPortalUser();
    if (!user) {
      return NextResponse.json({ authenticated: false } satisfies MeResponse);
    }
    const workspace = await getCompanyWorkspace(user);
    return NextResponse.json({ authenticated: true, user, workspace } satisfies MeResponse);
  } catch (e) {
    console.error('[auth/me]', e);
    return NextResponse.json({ authenticated: false } satisfies MeResponse);
  }
}
