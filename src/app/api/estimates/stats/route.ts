import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { getEstimateDashboardStats } from '@/lib/estimates/service';
import { requireModuleOrRespond } from '@/lib/modules/access';

export async function GET() {
  const portal = await requireModuleOrRespond('estimates');
  if (isPortalResponse(portal)) return portal;

  try {
    const stats = await getEstimateDashboardStats(portal.companyId);
    return NextResponse.json({ stats });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
