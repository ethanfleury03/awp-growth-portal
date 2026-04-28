import { NextResponse } from 'next/server';
import { getDefaultCompanyId, getEstimateDashboardStats } from '@/lib/estimates/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = (searchParams.get('company_id') || (await getDefaultCompanyId())) as string;
    const stats = await getEstimateDashboardStats(companyId);
    return NextResponse.json({ stats });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
