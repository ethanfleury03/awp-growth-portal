# Stripe payments rollout

WNY Automation Portal collects **estimate deposits** and **invoice payments** through **Stripe Checkout** using a **single platform Stripe account**. Company staff enable features under **Estimates → Defaults**; amounts are always computed on the server from SQLite.

## Environment

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Create Checkout Sessions |
| `STRIPE_WEBHOOK_SECRET` | Verify `POST /api/stripe/webhook` |
| `APP_BASE_URL` / `NEXT_PUBLIC_APP_BASE_URL` | Return URLs for Checkout (public origin) |

See `.env.example`.

## Data model

- **`company_payment_settings`** — toggles: online payments, estimate deposits, invoice payments.
- **`payments`** / **`payment_events`** — idempotent webhook reconciliation.
- **`estimates`** — `deposit_status`, `deposit_paid_at`; deposit paid via webhook can set `approved`.
- **`invoices`** — `amount_cents`, `tax_cents`, `total_cents`, `public_pay_token` (customer link).

Committed schema: `data/schema.sqlite.sql`. Existing DBs: `applyPaymentsMigrations` in `src/lib/db.ts`.

## Flows

1. **Deposit** — Customer opens `/estimate/[token]`, **Pay deposit** → Checkout → success → `/estimate/[token]/deposit/return`. Webhook marks deposit paid and approves estimate when configured.
2. **Invoice** — Staff copies `/pay/invoice/[token]` or opens Checkout from the invoice list. Customer pays on `/pay/invoice/[token]`. Webhook sets invoice `paid` and `paid_date`.

## Automated tests

- `src/lib/payments/invoice-money.test.ts` — cents normalization from invoice rows.

Run: `npm test`

## Manual QA checklist

1. **Deposits only** — Enable online + estimate deposits; send estimate with `deposit_amount_cents` > 0; customer pays; webhook fires; estimate approved + deposit paid.
2. **Invoices only** — Enable online + invoice payments; copy pay link; pay; invoice marked paid.
3. **Both enabled** — Smoke both flows.
4. **Payments disabled** — Checkout routes return 400.
5. **Cancel Checkout** — Customer returns with `?deposit=cancelled` on estimate; invoice cancel URL.
6. **Duplicate webhook** — Same Stripe event twice does not double-apply (`payment_events` dedupe).
7. **Paid invoice** — Pay link shows “already paid”; Checkout returns error.
8. **Staff manual approve** — Waives deposit requirement for conversion (deposit `waived`).
9. **Pending invoice payment** — Changing invoice amounts blocked while `payments.status = pending` for that invoice.

## Rollout order (recommended)

1. Deploy schema + code with Stripe keys on staging.
2. Configure webhook in Stripe Dashboard → endpoint URL + signing secret.
3. Enable **invoice payments** first (simpler state machine).
4. Enable **estimate deposits** after approval/deposit UX is verified.
5. Production: enable toggles per company in **Estimates → Defaults**.
