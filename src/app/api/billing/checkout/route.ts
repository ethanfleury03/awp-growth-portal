import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { createBillingCheckoutSession } from '@/lib/billing/service';

export async function POST() {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  const clerkUser = await currentUser().catch(() => null);
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    auth.email;
  const name = clerkUser?.fullName || auth.name;

  try {
    const result = await createBillingCheckoutSession({
      companyId: auth.companyId,
      clerkUserId: auth.id,
      customerEmail: email,
      customerName: name,
    });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start billing checkout' },
      { status: 500 },
    );
  }
}
