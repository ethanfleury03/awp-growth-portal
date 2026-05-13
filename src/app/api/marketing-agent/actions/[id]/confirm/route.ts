import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { approveMarketingAgentDraft } from '@/lib/marketing-agent/agent';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleOrRespond('crm');
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const result = await approveMarketingAgentDraft(auth.companyId, id);
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    result,
    message: 'Marketing draft approved. External sending still requires an email provider integration.',
  });
}
