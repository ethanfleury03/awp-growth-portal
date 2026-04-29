import { NextResponse } from 'next/server';
import { getPortalUser } from '@/lib/auth/portal-user';
import { getCompanyWorkspace } from '@/lib/workspace/workspace';

export async function GET() {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ workspace: await getCompanyWorkspace(user) });
}
