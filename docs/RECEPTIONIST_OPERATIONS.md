# Receptionist operations (production-shaped)

This document describes deterministic behaviors added for duplicate handling, caller linkage, case synthesis, staff workflow, evaluation, and deployment hygiene. It complements [RECEPTIONIST.md](./RECEPTIONIST.md) and [RECEPTIONIST_RETELL.md](./RECEPTIONIST_RETELL.md).

## Duplicate prevention and merge

- **Same call, same tool:** If an active `receptionist_bookings` row already exists for the call and booking type, the service returns the existing `bookingId` / `jobId` and records `duplicateResolution.outcome = same_call_reused`. Retell tool responses also treat a **prior successful** `book_callback` / `book_quote_visit` / `create_lead` invocation as **idempotent** (replays return the same ids without new CRM rows).
- **Cross-call merge:** For callbacks, quote visits, and leads, the system scores recent rows with the same **normalized phone** and similar **issue fingerprint** (plus address for visits). **High** confidence, or **medium** confidence when the call is treated as **emergency**, triggers a **merge**: the current call is linked to the existing **job** or **lead**; `duplicateResolution.outcome = cross_call_merged`; an event is logged (`duplicate_booking_cross_call_merged` or `duplicate_lead_cross_call_merged`). No second operational job/booking row is created for merges.
- **Weak matches:** **Medium** confidence without merge stores `duplicateResolution.outcome = potential_duplicate_noted` for staff review.
- **Emergency:** Emergency signals **lower the bar** for cross-call merge so repeat redials stay attached to the same operational record while **urgency metadata** remains intact.

Implementation: `src/lib/receptionist/duplicate-resolve.ts`, `src/lib/receptionist/service.ts`.

## Caller / case linkage

After each finalize / reprocess / live hardening pass, `enrichReceptionistMetaAfterSynthesis` runs `matchCallerToExistingEntities` (phone → customer → open lead → prior unresolved call with same issue). Results are stored under `receptionist_meta_json.callerLinkage` with `outcome`: `exact_customer_match` | `exact_lead_match` | `existing_open_case_match` | `probable_match_needs_review` | `no_match`.

Files: `src/lib/receptionist/caller-match.ts`, `src/lib/receptionist/enrich-receptionist-meta.ts`.

## Case synthesis

`buildReceptionistCaseRecord` produces a structured **`caseRecord`** in meta: canonical issue line, best phone/address, missing critical fields, ambiguities, recommended staff action, and a confidence map derived from existing field provenance. **Tool-confirmed** values take precedence over transcript inference in the underlying hardening layer; the case record surfaces **gaps** explicitly for operators.

File: `src/lib/receptionist/case-synthesize.ts`.

## Staff handoff

- **Tasks table:** `receptionist_staff_tasks` (see `data/schema.sqlite.sql` and `sqlite-migrate.ts`). Open urgent tasks are counted on the receptionist dashboard.
- **API:** `POST /api/receptionist/calls/[id]/staff-handoff` with JSON `{ "action": "assign_on_call" | "urgent_callback_task" | "dispatch_review" | "escalate_emergency" | "mark_resolved" | "mark_duplicate_no_action" | "link_customer_ack" }`.
- **Emergency without job:** When a call is flagged emergency and has **no** `job_id`, an **automatic** open `emergency_escalation` task is created (at most one open per call).

File: `src/lib/receptionist/staff-handoff.ts`.

## Evaluation suite

Run:

```bash
npm run receptionist:eval
```

Vitest exercises mock scenario dispositions, duplicate ranking, and case synthesis output. Add scenarios in `src/lib/receptionist/eval/receptionist-eval.test.ts`.

## Twilio signature verification

- **Production:** Keep `RECEPTIONIST_DEV_BYPASS_TWILIO_SIGNATURE` **unset** (or not `true`). Signatures are verified with `TWILIO_AUTH_TOKEN` unless `TWILIO_VERIFY_SIGNATURES=false` (debug only).
- **Public URL:** Twilio signs the **exact URL** they POST to. If `request.url` behind a proxy does not match, set **`TWILIO_WEBHOOK_PUBLIC_URL`** (no trailing slash) to the public origin so the validation URL is reconstructed as `{TWILIO_WEBHOOK_PUBLIC_URL}{pathname}{search}`.
- **Logging:** Failed validation logs hints in **development**.

Code: `resolveTwilioWebhookUrl`, `verifyTwilioVoiceRequest` in `src/lib/receptionist/receptionist-live.ts`.

## Retell agent readiness

- `npm run retell:setup` publishes the agent and audits tools. The script warns if `is_published=false` or tool audit fails.
- Keep **WNY Automation Portal** `receptionist_settings.retell_agent_id` (or `RETELL_AGENT_ID`) aligned with the agent created by setup.
- For production demos, confirm in the Retell dashboard that the agent is **published** and webhooks are reachable.

## Next.js dev / ngrok

Optional: set **`NEXT_PUBLIC_DEV_EXTRA_ORIGINS`** to a comma-separated list of tunnel origins (e.g. `https://abc.ngrok-free.app`) so Next can allow those dev origins (see `next.config.ts`).

## Environment summary

| Variable | Purpose |
|----------|---------|
| `APP_BASE_URL` / `NEXT_PUBLIC_APP_BASE_URL` | App base for links and Retell setup docs |
| `TWILIO_WEBHOOK_PUBLIC_URL` | Canonical public URL prefix for signature validation |
| `RECEPTIONIST_DEV_BYPASS_TWILIO_SIGNATURE` | `true` = skip Twilio signature check (dev only; warned in production) |
| `TWILIO_VERIFY_SIGNATURES` | `false` disables verification when not bypassing (local debug) |
| `NEXT_PUBLIC_DEV_EXTRA_ORIGINS` | Extra allowed dev origins (ngrok) |

## Reprocessing

`reprocess` and live `persistReceptionistHardeningForCall` both run **synthesis + enrichment**, so `caseRecord` and `callerLinkage` refresh from current transcript and tools.
