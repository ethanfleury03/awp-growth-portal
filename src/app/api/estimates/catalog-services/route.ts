import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { catalogServiceBodySchema } from '@/lib/estimates/validation';
import { createCatalogService, listCatalogServices } from '@/lib/estimates/catalog-services';
import { requireModuleOrRespond } from '@/lib/modules/access';

export async function GET() {
  const portal = await requireModuleOrRespond('estimates');
  if (isPortalResponse(portal)) return portal;

  try {
    const services = await listCatalogServices(portal.companyId);
    return NextResponse.json({ services });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const portal = await requireModuleOrRespond('estimates');
  if (isPortalResponse(portal)) return portal;

  try {
    const body = catalogServiceBodySchema.parse(await request.json());
    const svc = await createCatalogService(portal.companyId, body);
    return NextResponse.json({ service: svc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
