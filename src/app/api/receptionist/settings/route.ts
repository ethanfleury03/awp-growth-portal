import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { receptionistService } from '@/lib/receptionist/service';
import { patchSettingsSchema } from '@/lib/receptionist/validation';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET() {
  const portal = await requireModuleOrRespond('receptionist');
  if (isPortalResponse(portal)) return portal;

  try {
    const settings = await receptionistService.getSettings(portal.companyId);
    return NextResponse.json({ settings });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

async function applySettingsUpdate(request: Request, companyId: string) {
  const body = await request.json();
  const parsed = patchSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const settings = await receptionistService.updateSettings(companyId, parsed.data);
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const portal = await requireModuleOrRespond('receptionist');
  if (isPortalResponse(portal)) return portal;

  try {
    return await applySettingsUpdate(request, portal.companyId);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const portal = await requireModuleOrRespond('receptionist');
  if (isPortalResponse(portal)) return portal;

  try {
    return await applySettingsUpdate(request, portal.companyId);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
