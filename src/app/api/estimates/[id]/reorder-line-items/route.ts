import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reorderEstimateLineItems } from '@/lib/estimates/service';

const bodySchema = z.object({ orderedIds: z.array(z.string().min(8)) });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { orderedIds } = bodySchema.parse(await request.json());
    await reorderEstimateLineItems(id, orderedIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
