# AI Receptionist (WNY Automation Portal)

End-to-end proof of concept: mock/simulated calls, SQLite persistence, CRM integration (leads, jobs, call logs), and UI under **Receptionist** in the sidebar.

## Local setup

1. Install dependencies: `npm install`
2. Create / refresh the SQLite database (applies `data/schema.sqlite.sql` + `data/seed.sqlite.sql`):

   ```bash
   npm run db:init
   ```

   Alternatively, hit `GET /api/setup` once (same effect; idempotent schema + seed exec).

3. Start the app: `npm run dev`
4. Open [http://localhost:3003/receptionist](http://localhost:3003/receptionist).

No Twilio or AI keys are required for mock mode.

**Live Retell + Twilio:** see [RECEPTIONIST_RETELL.md](./RECEPTIONIST_RETELL.md), automated provisioning in [RECEPTIONIST_RETELL_SETUP_AUTOMATION.md](./RECEPTIONIST_RETELL_SETUP_AUTOMATION.md), and the agent script at [receptionist/retell-agent-script.md](./receptionist/retell-agent-script.md).

**Operations (dedupe, case synthesis, staff tasks, eval, deployment):** [RECEPTIONIST_OPERATIONS.md](./RECEPTIONIST_OPERATIONS.md).

## Testing mock calls

1. Go to **Receptionist**.
2. Pick a **scenario** (leaking faucet, burst pipe, callback, estimate, spam).
3. Click **Start sample call**, then **Next line** to stream one transcript turn at a time, or **Play scenario** to auto-advance every ~900ms.
4. When the last line is played, the call **finalizes automatically**: transcript, deterministic summary, extracted JSON, disposition, and a row in **call_logs** are written.
5. Use **End & save now** to fast-forward any remaining lines and finalize immediately.
6. Open a row in **Recent calls** for actions: create lead, book callback, book estimate visit, mark emergency/spam, reprocess.

**Settings**: [http://localhost:3003/receptionist/settings](http://localhost:3003/receptionist/settings) — company name, greeting, disclosure/recording toggles, JSON fields for hours/keywords/actions, provider type (`mock` / `retell` / `twilio` / `custom`), Retell agent id.

## Where data lives

| Area | Tables |
|------|--------|
| Config | `receptionist_settings`, `receptionist_mock_scenarios` |
| Calls | `receptionist_calls`, `receptionist_transcript_segments`, `receptionist_events` |
| Bookings | `receptionist_bookings` (+ `jobs` for calendar) |
| CRM | `leads`, `customers` |
| Calls log | `call_logs` (linked via `receptionist_calls.call_log_id`) |

Booked callbacks and quote visits create **`jobs`** with types **Callback** and **Estimate visit** so they appear on **Calendar** and **Jobs**.

## Future: Twilio

Set when you are ready (not required locally):

| Variable | Purpose |
|----------|---------|
| `RECEPTIONIST_PROVIDER` | `mock` (default) or `twilio` |
| `APP_BASE_URL` / `PUBLIC_BASE_URL` | Public URL for webhook callbacks |
| `TWILIO_ACCOUNT_SID` | Account |
| `TWILIO_AUTH_TOKEN` | Webhook signature validation (implement fully in `TwilioReceptionistProvider`) |
| `TWILIO_PHONE_NUMBER` | Your Twilio number |

Stub routes (JSON placeholders today):

- `POST /api/receptionist/webhooks/twilio/voice`
- `POST /api/receptionist/webhooks/twilio/status`

## Future: real AI / STT

Deterministic extraction lives in `src/lib/receptionist/extract.ts` (`extractCallFieldsFromTranscript`). Replace or delegate to a model behind `VoiceRuntimeAdapter` in `src/lib/receptionist/providers.ts` (e.g. implement `summarizeTranscript` / `extractStructured` and call from `finalizeReceptionistCall` when an env flag is set).

## Key source files

- `src/lib/receptionist/repository.ts` — DB access, mock advance/finalize, dashboard queries
- `src/lib/receptionist/service.ts` — lead/booking actions, settings
- `src/lib/receptionist/scenarios.ts` — built-in transcript scripts
- `src/app/api/receptionist/**` — HTTP API
- `src/app/(dashboard)/receptionist/**` — UI
