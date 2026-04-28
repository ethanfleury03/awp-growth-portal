# Marketing Site Operations

This document covers the public marketing site under `/`, `/features`, `/pricing`, `/industries`, `/about`, and `/contact`.

## Content map

- Homepage: `src/app/(marketing)/page.tsx`
- Features page: `src/app/(marketing)/features/page.tsx`
- Pricing page: `src/app/(marketing)/pricing/page.tsx`
- Industries page: `src/app/(marketing)/industries/page.tsx`
- Shared components: `src/app/(marketing)/_components/*`
- Brand styles: `src/app/(marketing)/marketing.css`

## Pricing and Checkout wiring

- Client CTA component: `src/app/(marketing)/_components/PlanCheckoutButton.tsx`
- Checkout API: `src/app/api/marketing/checkout/route.ts`
- Webhook processing: `src/app/api/stripe/webhook/route.ts`
- Subscription helpers: `src/lib/marketing/subscriptions.ts`
- Subscription storage:
  - Postgres schema: `src/db/schema/payments.ts` (`billing_subscriptions`)
  - SQLite migration: `src/lib/marketing/sqlite-marketing-migrate.ts`
  - SQL migrations: `drizzle/0002_marketing_billing_subscriptions.sql`

### Required Stripe env vars

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_STARTER_ANNUAL`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`

## Lead capture pipeline

- Form components:
  - `src/app/(marketing)/_components/LeadForm.tsx`
  - `src/app/(marketing)/_components/LeadModal.tsx`
- Leads API: `src/app/api/marketing/leads/route.ts`
- Lead service + notifications: `src/lib/marketing/leads.ts`
- Contact page: `src/app/(marketing)/contact/page.tsx`
- DB table:
  - Postgres schema: `src/db/schema/marketing.ts` (`marketing_leads`)
  - SQLite migration: `src/lib/marketing/sqlite-marketing-migrate.ts`
  - SQL migration: `drizzle/0003_marketing_leads.sql`

### Lead notification env vars

- `SLACK_LEADS_WEBHOOK_URL` (optional)
- `SALES_NOTIFY_EMAIL` (optional)
- `RESEND_API_KEY` + `ESTIMATE_FROM_EMAIL` (for email delivery)

## SEO and metadata files

- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/app/opengraph-image.tsx`
- `src/app/twitter-image.tsx`
- `src/app/manifest.ts`
- `src/app/icon.svg`
- `src/app/apple-icon.tsx`

## Analytics, consent, and observability

- Consent + analytics gate: `src/components/consent/ConsentManager.tsx`
- Mounted in root layout: `src/app/layout.tsx`
- Sentry configs:
  - `sentry.client.config.ts`
  - `sentry.server.config.ts`
  - `sentry.edge.config.ts`
  - `instrumentation.ts`
  - `instrumentation-client.ts`

## Regenerating marketing imagery

- Primary generator: `python scripts/generate_landing_images.py`
- Dependency install: `python -m pip install -r scripts/requirements-landing.txt`
- Config: `scripts/landing-images.json`
- Outputs:
  - `public/landing/*.jpg`
  - `public/industries/*.jpg`

If `GEMINI_API_KEY` is unavailable, fallback JPG placeholders can still be generated for local QA, but replace them with production imagery before launch.

## CI quality gates

- Workflow: `.github/workflows/ci.yml`
- Broken link check: `node scripts/check-marketing-links.mjs`
- Lighthouse config: `.lighthouserc.json`

## Useful commands

- `npm run marketing:check-links`
- `npm run marketing:lhci`
- `npm run stripe:seed-prices`
