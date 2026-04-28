import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { getOpenRouterModels } from '@/lib/ai/openrouter';

export async function GET() {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const result = await getOpenRouterModels();
  return NextResponse.json({
    ...result,
    configured: Boolean(process.env.OPENROUTER_API_KEY),
  });
}
