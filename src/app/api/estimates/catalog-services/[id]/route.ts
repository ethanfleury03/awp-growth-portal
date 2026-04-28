import { NextResponse } from 'next/server';
import { patchCatalogServiceBodySchema } from '@/lib/estimates/validation';
import { deleteCatalogService, updateCatalogService } from '@/lib/estimates/catalog-services';
import { getDefaultCompanyId } from '@/lib/estimates/service';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = patchCatalogServiceBodySchema.parse(await request.json());
    const companyId = await getDefaultCompanyId();
    const svc = await updateCatalogService(companyId, id, body);
    if (!svc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ service: svc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const companyId = await getDefaultCompanyId();
    const ok = await deleteCatalogService(companyId, id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
