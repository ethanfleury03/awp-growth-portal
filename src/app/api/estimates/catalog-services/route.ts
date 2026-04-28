import { NextResponse } from 'next/server';
import { catalogServiceBodySchema } from '@/lib/estimates/validation';
import { createCatalogService, listCatalogServices } from '@/lib/estimates/catalog-services';
import { getDefaultCompanyId } from '@/lib/estimates/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = (searchParams.get('company_id') || (await getDefaultCompanyId())) as string;
    const services = await listCatalogServices(companyId);
    return NextResponse.json({ services });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = catalogServiceBodySchema.parse(await request.json());
    const companyId = await getDefaultCompanyId();
    const svc = await createCatalogService(companyId, body);
    return NextResponse.json({ service: svc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
