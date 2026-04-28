import { NextResponse } from 'next/server';
import { duplicateEstimate } from '@/lib/estimates/service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const estimate = await duplicateEstimate(id);
    return NextResponse.json({ estimate });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
