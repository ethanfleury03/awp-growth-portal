import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { rejectReceptionistMockInProduction } from '@/lib/receptionist/mock-access';
import { receptionistService } from '@/lib/receptionist/service';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(request: Request) {
  const blocked = rejectReceptionistMockInProduction(process.env, request);
  if (blocked) return blocked;

  const portal = await requireModuleOrRespond('receptionist');
  if (isPortalResponse(portal)) return portal;

  try {
    const scenarios = await receptionistService.listScenarios();
    return NextResponse.json({ scenarios });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
