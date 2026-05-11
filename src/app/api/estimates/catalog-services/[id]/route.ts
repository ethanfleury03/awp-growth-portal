import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { patchCatalogServiceBodySchema } from '@/lib/estimates/validation';
import { deleteCatalogService, updateCatalogService } from '@/lib/estimates/catalog-services';
import { requireModuleOrRespond } from '@/lib/modules/access';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const portal = await requireModuleOrRespond('estimates');
  if (isPortalResponse(portal)) return portal;

  try {
    const { id } = await ctx.params;
    const body = patchCatalogServiceBodySchema.parse(await request.json());
    const svc = await updateCatalogService(portal.companyId, id, body);
    if (!svc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ service: svc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const portal = await requireModuleOrRespond('estimates');
  if (isPortalResponse(portal)) return portal;

  try {
    const { id } = await ctx.params;
    const ok = await deleteCatalogService(portal.companyId, id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
