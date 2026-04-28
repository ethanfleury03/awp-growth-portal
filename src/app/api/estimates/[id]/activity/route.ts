import { NextResponse } from 'next/server';
import { getEstimateActivity } from '@/lib/estimates/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const activity = await getEstimateActivity(id);
    return NextResponse.json({ activity });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
