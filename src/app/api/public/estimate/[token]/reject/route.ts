import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildEstimatePresentation, rejectEstimateByToken } from '@/lib/estimates/service';
import {
  consumePublicRateLimit,
  publicActionKey,
  publicRateLimitConfig,
} from '@/lib/public-rate-limit';

const bodySchema = z.object({ reason: z.string().max(2000).optional().nullable() });

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const { max, windowMs } = publicRateLimitConfig();
    const rl = consumePublicRateLimit(publicActionKey(request, token, 'reject'), max, windowMs);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const row = await rejectEstimateByToken(token, body.reason ?? null);
    const presentation = await buildEstimatePresentation(row!.id as string, { internal: false });
    return NextResponse.json({ ok: true, presentation });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
