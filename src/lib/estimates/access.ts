import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import type { SessionUser } from '@/lib/auth/types';
import { getEstimateByIdForCompany } from '@/lib/estimates/service';
import { requireModuleOrRespond } from '@/lib/modules/access';

export type EstimateAccess = {
  auth: SessionUser;
  estimate: Record<string, unknown>;
};

export function isEstimateAccessResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requireEstimateAccessOrRespond(
  estimateId: string,
): Promise<EstimateAccess | NextResponse> {
  const auth = await requireModuleOrRespond('estimates');
  if (isPortalResponse(auth)) return auth;

  const estimate = await getEstimateByIdForCompany(estimateId, auth.companyId);
  if (!estimate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return { auth, estimate };
}
