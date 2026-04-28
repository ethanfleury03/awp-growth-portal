import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getStripe } from '@/lib/payments/stripe';
import { getPortalUser } from '@/lib/auth/portal-user';
import {
  ensureBillingSubscriptionsTable,
  marketingAppBaseUrl,
  resolveMarketingPriceId,
  type BillingCycle,
  type MarketingPlan,
} from '@/lib/marketing/subscriptions';

const bodySchema = z.object({
  plan: z.enum(['starter', 'pro']),
  billingCycle: z.enum(['monthly', 'annual']),
});

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
    }

    const json = await request.json();
    const body = bodySchema.parse(json);

    const priceId = resolveMarketingPriceId(body.plan, body.billingCycle);
    if (!priceId) {
      return NextResponse.json(
        { error: `Missing Stripe price for ${body.plan}/${body.billingCycle}.` },
        { status: 400 },
      );
    }

    const { userId } = await auth();
    const [user, portal] = await Promise.all([
      userId ? currentUser().catch(() => null) : Promise.resolve(null),
      userId ? getPortalUser().catch(() => null) : Promise.resolve(null),
    ]);
    const email =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      undefined;

    const appBase = marketingAppBaseUrl();
    const metadata: Record<string, string> = {
      plan: body.plan,
      billing_cycle: body.billingCycle,
      price_id: priceId,
    };
    if (portal?.companyId) metadata.company_id = portal.companyId;
    if (userId) metadata.clerk_user_id = userId;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      customer_creation: 'always',
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 14,
        metadata,
      },
      metadata,
      success_url: `${appBase}/app?welcome=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/pricing?canceled=1`,
    });

    await ensureBillingSubscriptionsTable();

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout initialization failed' },
      { status: 500 },
    );
  }
}

export type MarketingCheckoutPayload = {
  plan: MarketingPlan;
  billingCycle: BillingCycle;
};
