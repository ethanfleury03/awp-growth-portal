import { NextResponse } from 'next/server';
import { buildEstimatePresentation, expireEstimateIfNeeded, getEstimateByPublicToken } from '@/lib/estimates/service';
import {
  consumePublicRateLimit,
  publicActionKey,
  publicRateLimitConfig,
} from '@/lib/public-rate-limit';

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const { max, windowMs } = publicRateLimitConfig();
    const viewMax = max * 3;
    const rl = consumePublicRateLimit(publicActionKey(request, token, 'get'), viewMax, windowMs);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }
    let row = await getEstimateByPublicToken(token);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const expired = await expireEstimateIfNeeded(row);
    if (expired) {
      row = (await getEstimateByPublicToken(token))!;
    }
    if ((row.status as string) === 'draft') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }
    const id = row.id as string;
    const presentation = await buildEstimatePresentation(id, { internal: false });
    return NextResponse.json(presentation);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
