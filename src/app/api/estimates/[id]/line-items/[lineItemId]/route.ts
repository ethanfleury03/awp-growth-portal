import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteEstimateLineItem, updateEstimateLineItem } from '@/lib/estimates/service';

const patchSchema = z.object({
  category: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  unit_price_cents: z.number().int().min(0).optional(),
  is_optional: z.boolean().optional(),
  is_taxable: z.boolean().optional(),
  option_group: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
});

type Ctx = { params: Promise<{ id: string; lineItemId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id, lineItemId } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    await updateEstimateLineItem(id, lineItemId, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id, lineItemId } = await ctx.params;
    await deleteEstimateLineItem(id, lineItemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
