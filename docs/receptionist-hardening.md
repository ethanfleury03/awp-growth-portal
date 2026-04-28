# Receptionist edge-case hardening

This document describes deterministic safety layers added around the WNY Automation Portal AI receptionist. LLM behavior is guided by `src/lib/receptionist/retell-setup/plumberPrompt.ts`; **policy enforcement** for bookings and outcomes lives primarily in TypeScript.

## Data model

- **`receptionist_calls.receptionist_meta_json`**: structured audit payload (completeness checklist, emergency tier, caller behavior, operational priority, field confidence/provenance, timing hints, confirmations, duplicate hints, tool fallbacks). Merged on finalize/reprocess and on tool-driven updates.
- **`extracted_json`**: still the primary structured extraction blob; post-call synthesis backfills fields (name, phone, issue) from transcript, ANI, and summary when explicit values are missing.

## Caller behavior classification

Each call is classified into one of these behaviors, persisted in `callerBehavior`:

| Behavior | Meaning |
|----------|---------|
| `neutral` | Insufficient signal to classify |
| `off_topic_warning` | Off-topic/abusive language, no plumbing content yet |
| `abusive_but_legitimate` | Abusive language occurred, but a real plumbing issue was identified |
| `spam_or_prank` | Non-plumbing content with spam signals; no legitimate plumbing issue |
| `legitimate_plumbing` | Standard plumbing inquiry |
| `emergency_legitimate` | Legitimate plumbing emergency (may include abusive language) |

**Key rules:**
- A call with both abusive behavior and a real plumbing issue → `abusive_but_legitimate`, NOT `spam_or_prank`
- `mark_spam` is blocked if emergency was already detected; softened to `abusive_but_legitimate` if plumbing content exists
- Emergency always takes precedence over spam classification
- `mark_spam` on a call with detected plumbing → reclassified as `abusive_but_legitimate` with rationale

## Operational priority vs data completeness

These are now **separate** concepts:

| Concept | Description |
|---------|-------------|
| `operationalPriority` | What human action is needed (emergency_callback_required, emergency_incomplete_but_urgent, urgent_follow_up, standard, low, spam_no_action) |
| `completeness` | Whether all data fields are captured (caller name, phone, address, issue, timing, etc.) |

**Emergency calls with incomplete data:**
- Disposition stays `emergency` — NEVER downgraded to `follow_up_needed`
- `operationalPriority` becomes `emergency_callback_required` (has phone) or `emergency_incomplete_but_urgent` (no phone)
- Completeness card shows "(emergency preserved despite gaps)" in the UI

## Post-call structured extraction / synthesis

When explicit extraction misses fields, the synthesis pass backfills from:
1. Explicit extracted fields (highest priority)
2. Transcript text (regex-based name and plumbing issue inference)
3. AI summary
4. Caller ANI / `from_phone` (for callback number)

Each field gets a confidence/provenance record:
- **Confidence**: `confirmed`, `inferred`, `weak`, `missing`
- **Provenance**: `explicit_tool_arg`, `caller_ani`, `transcript_inference`, `summary_inference`, `booking_record`, `unknown`

## Follow-up disposition

`follow_up_needed` is assigned when:

1. **Completeness** fails (see checklist in `evaluateReceptionistCallCompleteness`) — e.g. quoted visit without address, suspicious issue without `issue_confirmed`, live "booked" disposition without a scheduled `receptionist_bookings` row or successful `book_*` tool
2. **Tool failure recovery** — `recordToolFailureFallback` after a failed `create_lead` fallback from `book_callback` / `book_quote_visit`
3. **Original heuristics** in `decideDisposition` when no stronger outcome applies

**NEVER** for emergency calls — those stay at `emergency` disposition.

## Emergency detection

- **Tier** (`emergency` | `urgent` | `standard` | `spam`) is computed in `classifyEmergencyTier` from transcript text, configured `emergency_keywords_json`, and spam keyword hits
- **Emergency always wins**: if emergency keywords match AND spam signals exist, emergency takes precedence
- **Disposition** `emergency` still maps to the primary CRM emergency path; meta stores `emergencyTier` + `emergencyRationale` + `operationalPriority` for UI
- **Escalation**: `markEmergency` / Retell `flag_emergency` set `internalOutcome: emergency_flagged_pending_human` and reconcile any prior spam state

## Safety boundaries for troubleshooting

The Retell prompt now enforces:
- **1–2 sentence max** for safety guidance during emergencies
- No extended troubleshooting, step-by-step repair instructions, or diagnostic walkthroughs
- For sewage/overflow: advise staying away, prioritize human dispatch, no cleanup instructions
- The assistant stops offering mechanical advice after initial safety tip

## Anti-repetition

- Boundary responses limited to one sentence
- No stacking synonymous redirects
- AI identity disclosed once, not repeated

## Duplicate protection

- **Same call**: `findActiveBookingOnCall` returns an existing `scheduled`/`requested` booking; tools receive `duplicate: true` and meta `booking_duplicate_merged`
- **Cross-call hint**: `findRecentDuplicateBooking` (same `from_phone`, type, rolling window from `duplicateWindowMinutes`) logs hints in meta; it does **not** block booking by default

## Suspicious transcript / STT repair

- `detectSuspiciousIssueDescription` + `tryNormalizeIssuePhrase` (vocabulary map including **SyncLeague → sink leak**)
- Retell tools should send confirmation flags (`phone_confirmed`, `issue_confirmed`, etc.) so `book_callback` can proceed when the phrase was ambiguous

## Tool failure recovery (Retell)

- `book_callback` / `book_quote_visit` catch errors, audit as `error`, then try `createLeadFromCall`. On success: meta `booking_failed_fallback_lead_created`. On failure: `recordToolFailureFallback` → `follow_up_needed`
- HTTP **200** with `bookingFailed: true` so transport layers do not treat recovery as a hard failure; the agent must read the JSON body (see prompt)

## Fallback actions

| Situation | Fallback |
|-----------|----------|
| Booking fails | Create lead → `follow_up_needed` |
| Emergency + booking fails | Flag emergency → lead if possible → `emergency` preserved |
| Missing name but phone + issue exist | Lead created from caller ANI |
| Missing address for visit | Lead with address-needed status (`follow_up_needed`) |

## After hours

- `isLikelyAfterHours` parses coarse `business_hours_json` + current time in `booking_rules_json.timezone` (default `America/Toronto`)
- Stored in meta for summaries/UI; detailed policy strings still come from `get_receptionist_context`

## Browser vs Twilio sessions

- **Twilio-backed** rows carry `twilio_call_sid`; Retell **browser** rows typically do not
- Tool binding when IDs are null uses `findRetellBrowserToolFallbackCallId` (see `retell-tool-common.ts`); **webhook correlation** uses Retell `call.call_id` → `provider_call_id`

## UI visibility

### Call detail page
- **Operational priority**: separate from completeness, with color-coded badges
- **Caller behavior**: distinct badge for `abusive_but_legitimate` (orange), `emergency_legitimate` (red), `spam_or_prank` (gray)
- **Field confidence**: per-field confidence level and provenance source
- **Emergency preservation**: "(emergency preserved despite gaps)" label when emergency has incomplete data

### Dashboard
- **Urgent action needed**: separate counter from generic follow-up
- **Abusive but legitimate**: visible count
- **Behavior badges**: inline on each call row
- **Priority badges**: urgent indicator on non-emergency rows with urgent priority

## Manual test matrix (quick)

| Scenario | Expect |
|----------|--------|
| Mock scenario completes | `receptionist_meta_json` populated; checklist mostly pass |
| Off-topic → emergency | `callerBehavior: emergency_legitimate`, disposition stays `emergency` |
| Abusive + real leak | `callerBehavior: abusive_but_legitimate`, issue serviced normally |
| mark_spam after flag_emergency | Spam blocked; reclassified as `abusive_but_legitimate` |
| Emergency, missing name | Disposition `emergency` (not `follow_up_needed`), priority `emergency_incomplete_but_urgent` |
| Emergency, has phone | Priority `emergency_callback_required` |
| Retell `book_callback` with bad phone | Validation error → lead/follow-up fallback JSON |
| Duplicate `book_callback` same session | `duplicate: true`, no second job |
| Quote tool without address (Retell) | Error + fallback; dashboard "Book quote" skips address guard |
| Transcript-only extraction | Name, issue, phone inferred from transcript/ANI |

## npm scripts

- `npm test` — vitest deterministic checks (`src/**/*.test.ts`)
- `npm run build` — production compile
