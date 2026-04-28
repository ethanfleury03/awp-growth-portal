import { NextResponse } from 'next/server';
import { lineItemBodySchema } from '@/lib/estimates/validation';
import { addEstimateLineItem } from '@/lib/estimates/service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = lineItemBodySchema.parse(await request.json());
    const line = await addEstimateLineItem(id, {
      category: body.category ?? null,
      name: body.name,
      description: body.description ?? null,
      quantity: body.quantity,
      unit: body.unit,
      unit_price_cents: body.unit_price_cents,
      is_optional: body.is_optional,
      is_taxable: body.is_taxable,
      option_group: body.option_group ?? null,
      sort_order: body.sort_order,
    });
    return NextResponse.json({ lineItem: line });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
