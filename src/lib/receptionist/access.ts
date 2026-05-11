import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import type { SessionUser } from '@/lib/auth/types';
import { getReceptionistCallForCompany } from '@/lib/receptionist/repository';
import { requireModuleOrRespond } from '@/lib/modules/access';

export type ReceptionistCallAccess = {
  auth: SessionUser;
  call: Record<string, unknown>;
};

export function isReceptionistAccessResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requireReceptionistCallAccessOrRespond(
  callId: string,
): Promise<ReceptionistCallAccess | NextResponse> {
  const auth = await requireModuleOrRespond('receptionist');
  if (isPortalResponse(auth)) return auth;

  const call = await getReceptionistCallForCompany(callId, auth.companyId);
  if (!call) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return { auth, call };
}
