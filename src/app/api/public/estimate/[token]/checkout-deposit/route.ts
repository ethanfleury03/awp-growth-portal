import { NextResponse } from 'next/server';
import { z } from 'zod';
import { expireEstimateIfNeeded, getEstimateByPublicToken } from '@/lib/estimates/service';
import { createEstimateDepositCheckoutSession } from '@/lib/payments/payment-service';
import { estimateDepositAmountCents, onlinePaymentsActive } from '@/lib/payments/policy';
import { getCompanyPaymentSettings } from '@/lib/payments/company-settings';
import {
  consumePublicRateLimit,
  publicActionKey,
  publicRateLimitConfig,
} from '@/lib/public-rate-limit';

const bodySchema = z.object({
  email: z.string().email().optional(),
});

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const { max, windowMs } = publicRateLimitConfig();
    const rl = consumePublicRateLimit(publicActionKey(request, token, 'checkout-deposit'), max, windowMs);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    let row = await getEstimateByPublicToken(token);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await expireEstimateIfNeeded(row);
    row = (await getEstimateByPublicToken(token))!;
    const status = row.status as string;
    if (status === 'draft' || status === 'expired' || status === 'rejected' || status === 'converted') {
      return NextResponse.json({ error: 'Estimate cannot accept payment in this state.' }, { status: 400 });
    }
    if (status === 'approved') {
      return NextResponse.json({ error: 'This estimate is already approved.' }, { status: 400 });
    }

    const companyId = row.company_id as string;
    const settings = await getCompanyPaymentSettings(companyId);
    if (!(await onlinePaymentsActive(companyId)) || !settings.estimate_deposits_enabled) {
      return NextResponse.json({ error: 'Online deposits are not enabled for this business.' }, { status: 400 });
    }

    const amountCents = estimateDepositAmountCents(row);
    if (amountCents <= 0) {
      return NextResponse.json({ error: 'No deposit amount is set on this estimate.' }, { status: 400 });
    }

    const depSt = String(row.deposit_status || 'none');
    if (depSt === 'paid' || depSt === 'waived') {
      return NextResponse.json({ error: 'Deposit already satisfied.' }, { status: 400 });
    }

    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json);
    const email =
      body.email?.trim() ||
      (row.customer_email_snapshot as string | null) ||
      null;

    const result = await createEstimateDepositCheckoutSession({
      estimateId: row.id as string,
      estimateNumber: String(row.estimate_number),
      companyId,
      token,
      amountCents,
      customerEmail: email,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ url: result.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
