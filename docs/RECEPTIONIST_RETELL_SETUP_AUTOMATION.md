# Retell setup automation (WNY Automation Portal)

This repo includes a **one-shot script** that configures your Retell account via the official **`retell-sdk`**: it creates or updates a **Retell LLM** (response engine), attaches **custom HTTP tools** pointing at this app’s routes, creates or updates a **voice agent** with **webhook URL + events**, sets **post-call analysis** fields useful for WNY Automation Portal, picks a **voice**, and **publishes** the agent.

It does **not** replace Twilio/SIP wiring — see [RECEPTIONIST_RETELL.md](./RECEPTIONIST_RETELL.md) for PSTN → WNY Automation Portal → Retell.

## Prerequisites

- Node.js and `npm install` at the repo root.
- A Retell API key with permission to manage agents/LLMs.
- Your **public** app base URL (same host Twilio would call for webhooks), e.g. `https://abc.ngrok.app`.
- `RETELL_TOOL_SHARED_SECRET` matching what your deployed WNY Automation Portal expects (see [RECEPTIONIST_RETELL.md](./RECEPTIONIST_RETELL.md)).

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `RETELL_API_KEY` | Retell API authentication |
| `APP_BASE_URL` | Public origin, no trailing slash (used for webhook + custom tool URLs) |
| `RETELL_TOOL_SHARED_SECRET` | Embedded in each custom tool’s `Authorization: Bearer …` header in Retell |

## Optional environment variables

| Variable | Default / behavior |
|----------|-------------------|
| `RETELL_AGENT_ID` | If set, **update** this agent; otherwise **create** a new one |
| `RETELL_LLM_ID` | If set, **update** this LLM; otherwise **create** a new one |
| `RETELL_AGENT_NAME` | `WNY Automation Portal Receptionist` |
| `RETELL_VOICE_ID` | If set, validated with `voice.retrieve`; else auto-pick (`retell-Cimo` if available) |
| `RETELL_LLM_MODEL` | Text model, default `gpt-4.1-mini` (only if `RETELL_S2S_MODEL` unset) |
| `RETELL_S2S_MODEL` | Speech-to-speech model; **mutually exclusive** with `RETELL_LLM_MODEL` |
| `RECEPTIONIST_DEFAULT_TIMEZONE` | Agent timezone, default `America/Toronto` |

## Commands

```bash
# Provision / refresh Retell LLM + agent + tools + webhooks, publish, refresh generated docs
npm run retell:setup

# Same, and append RETELL_AGENT_ID / RETELL_LLM_ID to .env.local when missing (backup created)
npm run retell:setup -- --write-env

# Skip rewriting docs/receptionist/*.generated.* (faster, fewer git diffs)
npm run retell:setup -- --skip-docs

# Regenerate docs only (no Retell API calls). Uses APP_BASE_URL or placeholder.
npm run retell:write-docs
```

## What the script does (Retell API)

1. **LLM** — `llm.create` or `llm.update` with:
   - `general_prompt` from `docs/receptionist/retell-agent-script.md` if that file has substantial content, otherwise from `src/lib/receptionist/retell-setup/plumberPrompt.ts`
   - `begin_message`, `start_speaker: agent`, low `model_temperature`, `tool_call_strict_mode: true` (text models)
   - `general_tools`: Retell **custom** tools (`type: custom`) for each WNY Automation Portal function route, `args_at_root: true`, `POST`, Bearer secret header
   - Either `model` **or** `s2s_model`, never both
2. **Agent** — `agent.create` or `agent.update` with:
   - `response_engine: { type: 'retell-llm', llm_id }`, `voice_id`, `language: en-US`, `timezone`
   - `webhook_url` → `POST {APP_BASE_URL}/api/receptionist/providers/retell/webhook`
   - `webhook_events`: `call_started`, `call_ended`, `call_analyzed`, `transcript_updated`
   - `post_call_analysis_data` for CRM-friendly extraction (names aligned with `custom_analysis_data` merge in WNY Automation Portal)
   - `handbook_config` (AI disclosure, personality, scope, echo verification), `voice_emotion: calm`
   - `voicemail_option: null` to avoid conflicting with custom telephony bridging
3. **Publish** — `agent.publish(agent_id)` then `agent.retrieve` for version info.

## Generated artifacts (repo)

After a successful run (unless `--skip-docs`):

- `docs/receptionist/retell-functions.generated.md`
- `docs/receptionist/retell-functions.generated.json`
- `docs/receptionist/retell-agent-script.generated.md` (echo of the prompt sources used for the API)

## Idempotent re-runs

Safe to run repeatedly with the same `RETELL_AGENT_ID` / `RETELL_LLM_ID`: the script **updates** the same resources and **publishes** again. Rotate `RETELL_TOOL_SHARED_SECRET` in your env and rerun so Retell tool headers pick up the new value.

## Switching voice or model later

- **Voice:** set `RETELL_VOICE_ID` (or clear it to auto-select) and rerun `npm run retell:setup`.
- **Model:** set `RETELL_LLM_MODEL` or `RETELL_S2S_MODEL` (only one) and rerun.

## Verifying URLs

- Open the generated `docs/receptionist/retell-functions.generated.md` and confirm each URL matches your deployed host.
- In Retell dashboard, open the agent → tools should list the same paths under `/api/receptionist/providers/retell/functions/`.
- Webhook should match `src/app/api/receptionist/providers/retell/webhook/route.ts`.

## What you may still do manually in Retell

- **Billing / plan / rate limits** — account-level.
- **Twilio or SIP trunk** to reach WNY Automation Portal (not created by this script).
- **Optional dashboard tweaks** — e.g. extra guardrails, pronunciation dictionary, PII storage settings, or account-level webhooks (per-agent webhook is set by the script).
- If **Retell rejects** a combination (e.g. `tool_call_strict_mode` with a specific model), adjust env model or ask Retell support; the script uses only official SDK fields.

## WNY Automation Portal runtime

After provisioning, ensure **`registerPhoneCall`** uses the same agent: set **`RETELL_AGENT_ID`** in `.env.local` (or `retell_agent_id` in **Receptionist → Settings**). The setup script can append IDs with `--write-env` when those keys are missing from `.env.local`.

## Related

- Live integration overview: [RECEPTIONIST_RETELL.md](./RECEPTIONIST_RETELL.md)
- Hand-editable agent script (optional input to setup): [receptionist/retell-agent-script.md](./receptionist/retell-agent-script.md)
