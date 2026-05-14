import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { getBillingSummary } from '@/lib/billing/service';

export async function GET() {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  try {
    const summary = await getBillingSummary(auth.companyId);
    return NextResponse.json({ billing: summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load billing summary' },
      { status: 500 },
    );
  }
}
