import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { sendEstimate } from '@/lib/estimates/service';
import { isEstimateAccessResponse, requireEstimateAccessOrRespond } from '@/lib/estimates/access';

const bodySchema = z.object({
  recipientEmail: z.string().email().optional().nullable(),
  recipientPhone: z.string().min(3).max(32).optional().nullable(),
  channel: z.enum(['email', 'sms', 'auto']).optional(),
  emailSubject: z.string().max(500).optional().nullable(),
  emailBody: z.string().max(32000).optional().nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const access = await requireEstimateAccessOrRespond(id);
    if (isEstimateAccessResponse(access)) return access;
    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    const { userId: clerkUserId } = await auth();

    const result = await sendEstimate(id, {
      recipientEmail: body.recipientEmail,
      recipientPhone: body.recipientPhone,
      channel: body.channel,
      emailSubject: body.emailSubject,
      emailBody: body.emailBody,
      clerkUserId,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
