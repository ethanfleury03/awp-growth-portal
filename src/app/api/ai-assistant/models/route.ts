import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { ASSISTANT_MODEL_OPTIONS } from '@/lib/ai/models';

export async function GET() {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  return NextResponse.json({
    models: ASSISTANT_MODEL_OPTIONS,
    source: 'configured',
    configured: Boolean(process.env.OPENROUTER_API_KEY),
  });
}
