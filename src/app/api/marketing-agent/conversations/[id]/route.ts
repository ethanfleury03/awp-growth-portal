import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import {
  deleteMarketingAgentConversation,
  loadMarketingAgentConversation,
} from '@/lib/marketing-agent/agent';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleOrRespond('marketing');
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const conversation = await loadMarketingAgentConversation(auth.companyId, id);
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(conversation);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleOrRespond('marketing');
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  await deleteMarketingAgentConversation(auth.companyId, id);
  return NextResponse.json({ ok: true });
}
