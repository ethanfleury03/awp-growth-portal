# Receptionist manual test matrix

Use alongside `docs/receptionist-hardening.md`.

## Mock mode

1. Start any scenario → advance to completion → open call detail.  
   - Expect: disposition matches scenario, **Call quality & safety** card shows checklist, `sufficient` usually true for happy paths.
2. Reprocess from dashboard.  
   - Expect: meta + disposition re-evaluated.

## Retell browser

1. Ensure webhook delivered once (creates `receptionist_calls` with `provider_call_id`).  
2. Run tools with **null** `call_id` / `receptionist_call_id` but only one active browser row.  
   - Expect: tools bind via fallback; logs show `fallback_match`.
3. `book_callback` twice.  
   - Expect: second response includes `duplicate: true`.

## Retell + Twilio (live)

1. Inbound call completes → detail shows meta + emergency tier if applicable.  
2. Force transcript-only “callback booked” without tool → on finalize/reprocess, disposition may become `follow_up_needed` (booking not confirmed).

## Settings

1. Set `booking_rules_json` spam keywords → spammy transcript increases spam tier.  
2. Tighten `duplicateWindowMinutes` → more duplicate hint entries in meta.

## CRM / jobs

1. Successful booking → job row + booking `scheduled`.  
2. Failed booking with lead fallback → lead linked, disposition `lead_created` or `follow_up_needed`.
