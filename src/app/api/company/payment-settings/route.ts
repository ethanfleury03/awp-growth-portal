import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPortalUser } from '@/lib/auth/portal-user';
import { patchCompanyPaymentSettings, ensureCompanyPaymentSettings } from '@/lib/payments/company-settings';
import { stripeConfigured } from '@/lib/payments/policy';

const patchSchema = z.object({
  online_payments_enabled: z.boolean().optional(),
  estimate_deposits_enabled: z.boolean().optional(),
  invoice_payments_enabled: z.boolean().optional(),
  deposit_due_timing: z.string().min(1).optional(),
});

export async function GET() {
  try {
    const portal = await getPortalUser();
    if (!portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const settings = await ensureCompanyPaymentSettings(portal.companyId);
    return NextResponse.json({
      settings,
      stripeSecretConfigured: stripeConfigured(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const portal = await getPortalUser();
    if (!portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = patchSchema.parse(await request.json());
    const settings = await patchCompanyPaymentSettings(portal.companyId, body);
    return NextResponse.json({ settings, stripeSecretConfigured: stripeConfigured() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
