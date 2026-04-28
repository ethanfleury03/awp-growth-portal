import { NextResponse } from 'next/server';
import { getEstimateDeliveries } from '@/lib/estimates/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const deliveries = await getEstimateDeliveries(id);
    return NextResponse.json({ deliveries });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
