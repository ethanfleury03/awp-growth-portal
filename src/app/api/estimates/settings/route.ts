import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureEstimateSettings, getDefaultCompanyId, patchEstimateSettings } from '@/lib/estimates/service';

const patchSchema = z.object({
  company_id: z.string().uuid().optional(),
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = (searchParams.get('company_id') || (await getDefaultCompanyId())) as string;
    const settings = await ensureEstimateSettings(companyId);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = patchSchema.parse(await request.json());
    const companyId = (body.company_id || (await getDefaultCompanyId())) as string;
    const { company_id: _c, ...patch } = body;
    const settings = await patchEstimateSettings(companyId, patch);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
