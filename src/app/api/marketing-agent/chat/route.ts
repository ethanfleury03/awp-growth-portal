import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { runMarketingAgent } from '@/lib/marketing-agent/agent';

export async function POST(request: Request) {
  const auth = await requireModuleOrRespond('marketing');
  if (isPortalResponse(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const prompt = String(body.message || '').trim();
  if (!prompt) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  try {
    const result = await runMarketingAgent({
      companyId: auth.companyId,
      branchId: auth.branchId,
      userId: auth.id,
      conversationId: body.conversationId ? String(body.conversationId) : null,
      prompt,
      model: String(body.model || ''),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Marketing agent request failed' },
      { status: 500 },
    );
  }
}
