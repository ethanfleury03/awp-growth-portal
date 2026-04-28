import { NextResponse } from 'next/server';
import { convertEstimateToJob } from '@/lib/estimates/service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await convertEstimateToJob(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
