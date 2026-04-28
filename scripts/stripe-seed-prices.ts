import 'dotenv/config';
import Stripe from 'stripe';

type PlanSeed = {
  productKey: string;
  productName: string;
  priceKey: string;
  amount: number;
  interval: 'month' | 'year';
};

const seeds: PlanSeed[] = [
  {
    productKey: 'plumberos-starter',
    productName: 'WNY Automation Portal Starter',
    priceKey: 'plumberos-starter-monthly',
    amount: 14900,
    interval: 'month',
  },
  {
    productKey: 'plumberos-starter',
    productName: 'WNY Automation Portal Starter',
    priceKey: 'plumberos-starter-annual',
    amount: 149000,
    interval: 'year',
  },
  {
    productKey: 'plumberos-pro',
    productName: 'WNY Automation Portal Pro',
    priceKey: 'plumberos-pro-monthly',
    amount: 34900,
    interval: 'month',
  },
  {
    productKey: 'plumberos-pro',
    productName: 'WNY Automation Portal Pro',
    priceKey: 'plumberos-pro-annual',
    amount: 349000,
    interval: 'year',
  },
];

async function ensureProduct(stripe: Stripe, lookupKey: string, name: string): Promise<string> {
  const existing = await stripe.products.search({
    query: `active:'true' AND metadata['lookup_key']:'${lookupKey}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0].id;
  const created = await stripe.products.create({
    name,
    metadata: { lookup_key: lookupKey },
  });
  return created.id;
}

async function ensurePrice(
  stripe: Stripe,
  productId: string,
  lookupKey: string,
  amount: number,
  interval: 'month' | 'year',
): Promise<string> {
  const existing = await stripe.prices.search({
    query: `active:'true' AND lookup_key:'${lookupKey}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0].id;
  const created = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
  });
  return created.id;
}

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY is required.');
  }
  const stripe = new Stripe(stripeKey);

  const envMap: Record<string, string> = {};
  for (const seed of seeds) {
    const productId = await ensureProduct(stripe, seed.productKey, seed.productName);
    const priceId = await ensurePrice(stripe, productId, seed.priceKey, seed.amount, seed.interval);
    if (seed.priceKey === 'plumberos-starter-monthly') envMap.STRIPE_PRICE_STARTER_MONTHLY = priceId;
    if (seed.priceKey === 'plumberos-starter-annual') envMap.STRIPE_PRICE_STARTER_ANNUAL = priceId;
    if (seed.priceKey === 'plumberos-pro-monthly') envMap.STRIPE_PRICE_PRO_MONTHLY = priceId;
    if (seed.priceKey === 'plumberos-pro-annual') envMap.STRIPE_PRICE_PRO_ANNUAL = priceId;
  }

  console.log('Seed complete. Add these to your environment:');
  for (const [key, value] of Object.entries(envMap)) {
    console.log(`${key}=${value}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
