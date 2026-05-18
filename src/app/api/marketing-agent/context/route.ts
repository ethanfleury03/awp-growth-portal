import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { ASSISTANT_MODEL_OPTIONS } from '@/lib/ai/models';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { buildMarketingAgentSnapshot } from '@/lib/marketing-agent/agent';

export async function GET() {
  const auth = await requireModuleOrRespond('marketing');
  if (isPortalResponse(auth)) return auth;

  try {
    const context = await buildMarketingAgentSnapshot(auth.companyId, auth.branchId);
    return NextResponse.json({
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      models: ASSISTANT_MODEL_OPTIONS,
      context,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load marketing agent context' },
      { status: 500 },
    );
  }
}
