import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import {
  createOnboardingLink,
  ensureConnectAccount,
  getCompanyConnectInfo,
  refreshConnectStatus,
} from '@/lib/payments/connect';

export async function GET() {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const info = await getCompanyConnectInfo(auth.companyId);
  return NextResponse.json({ connect: info });
}

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || 'onboard');

  const companyRows = await sql`
    SELECT id, name, email FROM companies WHERE id = ${auth.companyId} LIMIT 1
  `;
  const company = companyRows[0] as { id: string; name: string; email: string } | undefined;
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  try {
    if (action === 'onboard' || action === 'resume') {
      const stripeAccountId = await ensureConnectAccount({
        companyId: company.id,
        companyName: company.name,
        companyEmail: company.email,
      });
      const url = await createOnboardingLink({ companyId: company.id, stripeAccountId });
      return NextResponse.json({ url });
    }

    if (action === 'refresh') {
      const status = await refreshConnectStatus(auth.companyId);
      return NextResponse.json({ status });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Connect failed' },
      { status: 500 },
    );
  }
}
