import { NextResponse } from 'next/server';
import { z } from 'zod';
import { approveEstimateByToken, buildEstimatePresentation } from '@/lib/estimates/service';
import {
  consumePublicRateLimit,
  publicActionKey,
  publicRateLimitConfig,
} from '@/lib/public-rate-limit';

const bodySchema = z.object({
  acknowledge: z.boolean().optional(),
  signerName: z.string().max(200).optional().nullable(),
});

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const { max, windowMs } = publicRateLimitConfig();
    const rl = consumePublicRateLimit(publicActionKey(request, token, 'approve'), max, windowMs);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }
    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json);
    const row = await approveEstimateByToken(token, {
      acknowledge: body.acknowledge,
      signerName: body.signerName ?? null,
    });
    const presentation = await buildEstimatePresentation(row!.id as string, { internal: false });
    return NextResponse.json({ ok: true, presentation });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
