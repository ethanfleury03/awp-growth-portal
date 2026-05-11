# Retell + Twilio (live AI receptionist)

This extends the mock receptionist with **custom telephony**: Twilio answers PSTN, your server calls **Retell `registerPhoneCall`**, and Twilio **dials SIP** `sip:{retell_call_id}@sip.retellai.com`.

**Automated Retell dashboard setup (LLM, agent, tools, webhooks):** see [RECEPTIONIST_RETELL_SETUP_AUTOMATION.md](./RECEPTIONIST_RETELL_SETUP_AUTOMATION.md) and run `npm run retell:setup`.

Mock mode is unchanged (`/receptionist` sample calls).

## Environment variables

See root `.env.example`. Minimum for live inbound:

| Variable | Purpose |
|----------|---------|
| `APP_BASE_URL` | Public origin Twilio hits (e.g. `https://abc.ngrok.io`) — must match webhook URL used for signature verification |
| `RETELL_API_KEY` | Retell API (use a key **allowed for webhook verification** when verifying signatures) |
| `RETELL_AGENT_ID` | Default agent id (optional if set in **Receptionist settings → Retell agent ID**) |
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio auth (for request signature validation) |
| `RETELL_TOOL_SHARED_SECRET` | Bearer / `x-retell-tool-secret` for custom function HTTP endpoints |

Optional toggles:

| Variable | Default | Purpose |
|----------|---------|---------|
| `RECEPTIONIST_PROVIDER` | `mock` | Informational / ops; live webhooks work when configured |
| `RETELL_VERIFY_WEBHOOKS` | `true` | Set `false` only for local debugging |
| `TWILIO_VERIFY_SIGNATURES` | `true` | Set `false` only for local debugging |
| `RECEPTIONIST_DEV_BYPASS_RETELL_SIGNATURE` | `false` | Dev bypass Retell signature |
| `RECEPTIONIST_DEV_BYPASS_TWILIO_SIGNATURE` | `false` | Dev bypass Twilio signature |
| `RECEPTIONIST_DEFAULT_TIMEZONE` | `America/Toronto` | After-hours hinting in `get_availability` |

## HTTP routes

| Method | Path | Role |
|--------|------|------|
| POST | `/api/receptionist/providers/twilio/voice` | Twilio Voice webhook → Retell register → TwiML `<Dial><Sip>…` |
| POST | `/api/receptionist/providers/twilio/status` | Twilio status callbacks → `receptionist_events` |
| POST | `/api/receptionist/providers/retell/webhook` | Retell events → update `receptionist_calls`, transcript, finalize |
| POST | `/api/receptionist/providers/retell/functions/*` | Custom tools (auth required) |

Legacy aliases (same handlers):

- `/api/receptionist/webhooks/twilio/voice`
- `/api/receptionist/webhooks/twilio/status`

## Twilio console

1. Buy / port a number on a **SIP trunk** terminated at Retell per [Retell Twilio guide](https://docs.retellai.com/deploy/twilio).
2. Set **Voice webhook** (HTTP POST) to:
   - `{APP_BASE_URL}/api/receptionist/providers/twilio/voice`
3. Optional: **Status callback** to:
   - `{APP_BASE_URL}/api/receptionist/providers/twilio/status`

## Retell dashboard

1. Create an **agent** (prompt — see `docs/receptionist/retell-agent-script.md`).
2. Add **custom functions** pointing to your deployed base URL, for example:
   - `POST {APP_BASE_URL}/api/receptionist/providers/retell/functions/get_receptionist_context`
   - `POST …/get_availability`
   - `POST …/create_lead`
   - `POST …/book_callback`
   - `POST …/book_quote_visit`
   - `POST …/flag_emergency`
   - `POST …/mark_spam`
   - `POST …/end_call_notes` (optional)
3. Configure HTTP headers on each tool:
   - `Authorization: Bearer <RETELL_TOOL_SHARED_SECRET>` **or**
   - `x-retell-tool-secret: <RETELL_TOOL_SHARED_SECRET>`
4. Set **webhook URL** to:
   - `{APP_BASE_URL}/api/receptionist/providers/retell/webhook`
5. Register **metadata**: WNY Automation Portal passes `receptionist_call_id` in `registerPhoneCall.metadata` so tools can resolve rows; tools also accept Retell `call_id` as `call_id`.

## Tool request shape

All tools accept JSON with either:

- `receptionist_call_id`: WNY Automation Portal `receptionist_calls.id`, or  
- `call_id`: Retell call id (matches `receptionist_calls.provider_call_id`)

Optional fields for CRM merges: `caller_name`, `phone`, `address`, `issue`, `issue_description`, `urgency`, `preferred_callback_window`, `preferred_visit_window`.

Responses:

```json
{ "ok": true, "leadId": "…" }
```

or

```json
{ "ok": false, "error": { "code": "tool_error", "message": "…" } }
```

## Local testing

1. Run `npm run dev`.
2. Expose with **ngrok** (or similar): `ngrok http 3003`.
3. Set `APP_BASE_URL` to the HTTPS ngrok URL.
4. For first tests you may set `RECEPTIONIST_DEV_BYPASS_TWILIO_SIGNATURE=true` (dev only).

## SQLite

New / migrated columns and `receptionist_tool_invocations` are applied automatically on startup (`applyReceptionistMigrations` in `src/lib/db.ts`).

## Flow summary

1. Caller hits Twilio number → Twilio POSTs voice webhook.
2. WNY Automation Portal creates `receptionist_calls` (`provider=retell`, `twilio_call_sid`), calls Retell `registerPhoneCall`, stores `provider_call_id`.
3. TwiML dials `sip:{call_id}@sip.retellai.com`.
4. Retell streams conversation; tools hit WNY Automation Portal; webhooks update transcript and status.
5. On end/analyze, WNY Automation Portal finalizes row and creates `call_logs` when appropriate.
