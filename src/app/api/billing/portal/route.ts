import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { createBillingPortalSession } from '@/lib/billing/service';

export async function POST() {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  try {
    const result = await createBillingPortalSession(auth.companyId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to open Stripe billing portal' },
      { status: 500 },
    );
  }
}
