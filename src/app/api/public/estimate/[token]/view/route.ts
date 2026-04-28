import { NextResponse } from 'next/server';
import { markEstimateViewedByToken } from '@/lib/estimates/service';
import { buildEstimatePresentation } from '@/lib/estimates/service';
import {
  consumePublicRateLimit,
  publicActionKey,
  publicRateLimitConfig,
} from '@/lib/public-rate-limit';

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const { max, windowMs } = publicRateLimitConfig();
    const viewMax = max * 3;
    const rl = consumePublicRateLimit(publicActionKey(request, token, 'view'), viewMax, windowMs);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }
    const row = await markEstimateViewedByToken(token);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const presentation = await buildEstimatePresentation(row.id as string, { internal: false });
    return NextResponse.json({ ok: true, presentation });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
