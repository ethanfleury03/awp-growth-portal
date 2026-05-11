import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isPortalResponse } from '@/lib/auth/tenant';
import { ensureEstimateSettings, patchEstimateSettings } from '@/lib/estimates/service';
import { requireModuleOrRespond } from '@/lib/modules/access';

const patchSchema = z.object({
  company_name: z.string().min(1).optional(),
  logo_url: z.string().nullable().optional(),
  accent_color: z.string().nullable().optional(),
  estimate_footer_text: z.string().nullable().optional(),
  default_terms_text: z.string().nullable().optional(),
  default_expiration_days: z.number().int().min(1).max(3650).optional(),
  default_tax_rate_basis_points: z.number().int().min(0).nullable().optional(),
  estimate_prefix: z.string().min(1).max(20).optional(),
  default_deposit_enabled: z.boolean().optional(),
  default_deposit_percent_basis_points: z.number().int().min(0).nullable().optional(),
  customer_signature_required: z.boolean().optional(),
  allow_customer_reject: z.boolean().optional(),
  public_approval_requires_token: z.boolean().optional(),
});

export async function GET() {
  const portal = await requireModuleOrRespond('estimates');
  if (isPortalResponse(portal)) return portal;

  try {
    const settings = await ensureEstimateSettings(portal.companyId);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const portal = await requireModuleOrRespond('estimates');
  if (isPortalResponse(portal)) return portal;

  try {
    const body = patchSchema.parse(await request.json());
    const settings = await patchEstimateSettings(portal.companyId, body);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
