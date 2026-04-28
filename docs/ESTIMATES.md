# Estimates / Quotes module

## What it does

Office staff and technicians can build line-item estimates, preview a customer-facing page, send or share a secure link, track status (draft through converted), and turn an approved estimate into a job. Activity and delivery rows record the timeline.

## Creating and editing

1. Open **Estimates** in the sidebar (or use **New estimate** from a lead or receptionist call where linked).
2. **Service catalog** lives under CRM: **CRM → Service catalog** (`/crm/service-catalog`) for full CRUD on reusable services (name, description, default price).
3. On **New estimate** (`/estimates/new`), add lines with a **catalog dropdown** (fills name/price), editable **qty**, **unit price**, **description**, and optional **estimate-level discount**; a **live preview** shows totals. **Create & edit** sends `initial_line_items` (and `discount_amount_cents` when set).
4. Create from blank or with query params: `lead_id`, `customer_id`, `job_id`, `receptionist_call_id` on `/estimates/new`.
5. On the estimate editor, **Quick add from catalog** pulls live rows from **CRM → Service catalog** (same CRUD as `/crm/service-catalog`). Hardcoded presets were removed.
6. Add line items manually or via quick add (optional **option_group** on the line-items API for good/better/best). Totals are recalculated on the server.

### Services catalog (API)

- `GET/POST /api/estimates/catalog-services` — list / create company-scoped services (`estimate_catalog_services`).
- `PATCH/DELETE /api/estimates/catalog-services/[id]` — update or remove a service.
- `POST /api/estimates` accepts optional `catalog_service_ids: string[]` (UUIDs, in order) to seed line items from the catalog, or **`initial_line_items`** (full line payloads; used by the new-estimate UI and overrides `catalog_service_ids` when present).

## Sending (email, SMS, auto)

- **Resend:** set `RESEND_API_KEY` and `ESTIMATE_FROM_EMAIL` so **Send / log delivery** can send real email when channel is email or **auto** and a recipient email exists.
- **Twilio SMS:** set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` (or `TWILIO_FROM_NUMBER`) for SMS channel or **auto** when only a phone is available.
- **Legacy:** `ESTIMATE_DELIVERY_PROVIDER` — `mock` (default), `console`, or stub behavior via `src/lib/estimates/delivery.ts`.
- **Public link base:** `APP_BASE_URL` or `NEXT_PUBLIC_APP_BASE_URL` (fallback `http://localhost:3003`) for links in copy/email/SMS bodies.
- **PDF:** staff can use **Download PDF** on the estimate detail page (`GET /api/estimates/[id]/pdf`).
- **Public rate limits:** optional `PUBLIC_ESTIMATE_RATE_LIMIT_MAX` and `PUBLIC_ESTIMATE_RATE_LIMIT_WINDOW_SEC` (see `src/lib/public-rate-limit.ts`).

## Customer approval

Customers open `/estimate/[token]` (unguessable token). First meaningful view can move status toward **viewed**. Approve/reject POST handlers validate the token. Internal notes are never shown on the public page.

## Converting to a job

Only **approved** estimates convert once; **converted_to_job_id** and `jobs.source_estimate_id` link the records. Duplicate an estimate to revise after approval.

## Estimate numbers

Per company and calendar year, sequence rows in **estimate_number_sequences** allocate the next id inside a transaction. Display format is `{prefix}-{year}-{seq}` (prefix from **estimate_settings**).

## Tests

See `src/lib/estimates/estimates.test.ts` for totals, transitions, public flows, send mock, duplicate, and convert guards.
