import { NextResponse } from 'next/server';
import { patchEstimateBodySchema } from '@/lib/estimates/validation';
import {
  archiveEstimate,
  buildEstimatePresentation,
  getEstimateById,
  updateEstimate,
} from '@/lib/estimates/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const presentation = await buildEstimatePresentation(id, { internal: true });
    if (!presentation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(presentation);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = patchEstimateBodySchema.parse(await request.json());
    const est = await getEstimateById(id);
    if (!est) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await updateEstimate(id, {
      title: body.title,
      description: body.description,
      status: body.status,
      notes_internal: body.notes_internal,
      notes_customer: body.notes_customer,
      expiration_date: body.expiration_date,
      discount_amount_cents: body.discount_amount_cents,
      tax_rate_basis_points: body.tax_rate_basis_points,
      deposit_amount_cents: body.deposit_amount_cents,
      assigned_to_plumber_id: body.assigned_to_plumber_id,
      selected_option_group: body.selected_option_group,
    });
    return NextResponse.json({ estimate: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const est = await getEstimateById(id);
    if (!est) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await archiveEstimate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
