/**
 * One-shot Retell provisioning for WNY Automation Portal (LLM + voice agent + webhooks + custom tools).
 * Run from repo root: npm run retell:setup
 *
 * Flags:
 *   --write-env   Backup .env.local and upsert RETELL_AGENT_ID / RETELL_LLM_ID
 *   --skip-docs   Do not rewrite docs/receptionist/*.generated.*
 */
import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import Retell from 'retell-sdk';
import type { AgentCreateParams, AgentResponse, AgentUpdateParams } from 'retell-sdk/resources/agent';
import type { LlmCreateParams, LlmUpdateParams } from 'retell-sdk/resources/llm';

import {
  buildRetellCustomTools,
  RECEPTIONIST_FUNCTION_SPECS,
} from '../src/lib/receptionist/retell-setup/retellFunctionSpecs';
import { getPlumberRetellGeneralPrompt, PLUMBER_RETELL_BEGIN_MESSAGE } from '../src/lib/receptionist/retell-setup/plumberPrompt';
import { retellWebhookUrl } from '../src/lib/receptionist/retell-setup/routes';
import { writeGeneratedDocs } from '../src/lib/receptionist/retell-setup/writeGeneratedDocs';

const TEXT_MODELS = [
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5.1',
  'gpt-5.2',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'claude-4.5-sonnet',
  'claude-4.6-sonnet',
  'claude-4.5-haiku',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.0-flash',
] as const;

type TextModel = (typeof TEXT_MODELS)[number];

const S2S_MODELS = ['gpt-realtime-1.5', 'gpt-realtime', 'gpt-realtime-mini'] as const;
type S2sModel = (typeof S2S_MODELS)[number];

function maskSecret(s: string, visible = 4): string {
  if (s.length <= visible) return '****';
  return `****${s.slice(-visible)}`;
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function parseArgs(argv: string[]) {
  return {
    writeEnv: argv.includes('--write-env'),
    skipDocs: argv.includes('--skip-docs'),
  };
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function resolvePromptFromRepo(repoRoot: string): string {
  const mdPrimary = path.join(repoRoot, 'docs', 'receptionist', 'retell-agent-script.md');
  if (fs.existsSync(mdPrimary)) {
    const raw = fs.readFileSync(mdPrimary, 'utf8');
    const withoutFront = raw.replace(/^---[\s\S]*?---\s*/m, '');
    const lines = withoutFront.split('\n');
    const body: string[] = [];
    for (const line of lines) {
      if (line.startsWith('# ') && body.length === 0) continue;
      body.push(line);
    }
    const text = body.join('\n').trim();
    if (text.length > 80) {
      console.log('[retell:setup] Using general prompt from docs/receptionist/retell-agent-script.md');
      return text;
    }
  }
  console.log('[retell:setup] Using built-in prompt from src/lib/receptionist/retell-setup/plumberPrompt.ts');
  return getPlumberRetellGeneralPrompt();
}

function parseLlmModelChoice(): Pick<LlmCreateParams, 'model' | 's2s_model'> {
  const s2sRaw = process.env.RETELL_S2S_MODEL?.trim() as S2sModel | undefined;
  const textRaw = process.env.RETELL_LLM_MODEL?.trim() as TextModel | undefined;
  if (s2sRaw && textRaw) {
    console.error('Set only one of RETELL_S2S_MODEL or RETELL_LLM_MODEL (they are mutually exclusive).');
    process.exit(1);
  }
  if (s2sRaw) {
    if (!S2S_MODELS.includes(s2sRaw as S2sModel)) {
      console.error(`Invalid RETELL_S2S_MODEL "${s2sRaw}". Allowed: ${S2S_MODELS.join(', ')}`);
      process.exit(1);
    }
    return { s2s_model: s2sRaw as LlmCreateParams['s2s_model'] };
  }
  const model = (textRaw || 'gpt-4.1-mini') as TextModel;
  if (!TEXT_MODELS.includes(model)) {
    console.error(
      `Invalid RETELL_LLM_MODEL "${model}". Use one of: ${TEXT_MODELS.join(', ')} (or set RETELL_S2S_MODEL instead).`,
    );
    process.exit(1);
  }
  return { model: model as LlmCreateParams['model'] };
}

async function pickVoiceId(client: Retell, preferred?: string | null): Promise<string> {
  const list = await client.voice.list();
  if (!list.length) {
    throw new Error('Retell returned no voices for this account.');
  }
  if (preferred) {
    try {
      await client.voice.retrieve(preferred);
      console.log(`[retell:setup] Using RETELL_VOICE_ID=${preferred} (validated via retrieve).`);
      return preferred;
    } catch {
      console.warn(`[retell:setup] RETELL_VOICE_ID=${preferred} not found; falling back to auto-select.`);
    }
  }
  const byId = list.find((v) => v.voice_id === 'retell-Cimo');
  if (byId) {
    console.log('[retell:setup] Selected voice retell-Cimo (default).');
    return byId.voice_id;
  }
  const americanish = list.filter((v) => {
    const a = (v.accent || '').toLowerCase();
    const n = (v.voice_name || '').toLowerCase();
    return (
      a.includes('american') ||
      a.includes('us english') ||
      a.includes('u.s.') ||
      n.includes('american')
    );
  });
  const pool = americanish.length ? americanish : list;
  const choice = pool[0];
  console.log(`[retell:setup] Selected voice ${choice.voice_id} (${choice.voice_name}).`);
  return choice.voice_id;
}

function postCallAnalysisFields(): AgentCreateParams['post_call_analysis_data'] {
  return [
    {
      type: 'string',
      name: 'caller_full_name',
      description: 'Caller full name if stated.',
    },
    {
      type: 'string',
      name: 'callback_phone',
      description: 'Best callback number in E.164 or as spoken digits.',
    },
    {
      type: 'string',
      name: 'service_address',
      description: 'Service or property address for visits.',
    },
    {
      type: 'string',
      name: 'issue_summary',
      description: 'One short sentence describing the plumbing issue.',
    },
    {
      type: 'enum',
      name: 'urgency_level',
      description: 'Overall urgency from the conversation.',
      choices: ['low', 'medium', 'high', 'emergency'],
    },
    {
      type: 'enum',
      name: 'booking_outcome',
      description: 'What was accomplished on the call.',
      choices: ['callback_booked', 'quote_visit_booked', 'lead_only', 'spam', 'abandoned', 'unknown'],
    },
    {
      type: 'boolean',
      name: 'emergency_reported',
      description: 'True if an emergency was discussed or flagged.',
    },
  ];
}

function buildLlmPayload(
  generalPrompt: string,
  tools: LlmCreateParams['general_tools'],
  modelChoice: Pick<LlmCreateParams, 'model' | 's2s_model'>,
): LlmCreateParams {
  const useS2s = Boolean(modelChoice.s2s_model);
  const base: LlmCreateParams = {
    general_prompt: generalPrompt,
    begin_message: PLUMBER_RETELL_BEGIN_MESSAGE,
    start_speaker: 'agent',
    general_tools: tools ?? [],
    model_temperature: 0.2,
    /** Strict tool JSON is for supported text models; omit for s2s stacks. */
    tool_call_strict_mode: useS2s ? null : true,
    ...modelChoice,
  };
  return base;
}

function buildAgentPayload(
  llmId: string,
  voiceId: string,
  webhookUrl: string,
  agentName: string,
  timezone: string,
): AgentUpdateParams {
  return {
    agent_name: agentName,
    response_engine: { type: 'retell-llm', llm_id: llmId },
    voice_id: voiceId,
    language: 'en-US',
    timezone,
    webhook_url: webhookUrl,
    webhook_events: ['call_started', 'call_ended', 'call_analyzed', 'transcript_updated'],
    webhook_timeout_ms: 20_000,
    voice_emotion: 'calm',
    handbook_config: {
      ai_disclosure: true,
      default_personality: true,
      scope_boundaries: true,
      echo_verification: true,
    },
    post_call_analysis_data: postCallAnalysisFields(),
    post_call_analysis_model: 'gpt-4.1-mini',
    voicemail_option: null,
    enable_backchannel: false,
  };
}

function upsertEnvLocal(repoRoot: string, updates: Record<string, string>): void {
  const envPath = path.join(repoRoot, '.env.local');
  const backupPath = path.join(repoRoot, `.env.local.backup.${Date.now()}`);
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, backupPath);
    console.log(`[retell:setup] Backed up .env.local → ${path.basename(backupPath)}`);
  }
  const keys = new Set(Object.keys(updates));
  const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
  const out: string[] = [];
  const written = new Set<string>();
  for (const line of lines) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (m && keys.has(m[1])) {
      out.push(`${m[1]}=${updates[m[1]]}`);
      written.add(m[1]);
    } else {
      out.push(line);
    }
  }
  for (const [k, v] of Object.entries(updates)) {
    if (!written.has(k)) out.push(`${k}=${v}`);
  }
  fs.writeFileSync(envPath, out.join('\n').replace(/\n+$/, '\n'), 'utf8');
  console.log(`[retell:setup] Updated .env.local (${[...keys].join(', ')})`);
}

function readEnvValue(repoRoot: string, key: string): string | undefined {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return undefined;
  const text = fs.readFileSync(envPath, 'utf8');
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const m = text.match(re);
  return m?.[1]?.trim().replace(/^["']|["']$/g, '');
}

function printSuccessSummary(rows: Record<string, string>) {
  const w = Math.max(...Object.keys(rows).map((k) => k.length), 14);
  console.log('\n=== Retell setup — success ===\n');
  for (const [k, v] of Object.entries(rows)) {
    console.log(`${k.padEnd(w)}  ${v}`);
  }
  console.log('');
}

/**
 * Retell `publish-agent` often returns 2xx with an empty body while still advertising
 * JSON. Awaiting the SDK promise runs the default parser, which calls `response.json()`
 * and throws "Unexpected end of JSON input". Using `.asResponse()` skips body parsing.
 */
async function publishAgentWithoutJsonBody(client: Retell, agentId: string, version: number): Promise<Response> {
  const response = await client.agent.publish(agentId, { version }).asResponse();
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Publish failed: HTTP ${response.status} ${errText.slice(0, 500)}`);
  }
  return response;
}

function urlsMatch(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  return normalizeBaseUrl(a) === normalizeBaseUrl(b);
}

type CustomToolEntry = { type: 'custom'; name: string };

function isCustomTool(t: unknown): t is CustomToolEntry {
  return (
    typeof t === 'object' &&
    t !== null &&
    (t as { type?: string }).type === 'custom' &&
    typeof (t as { name?: string }).name === 'string'
  );
}

async function logPublishedConfigAudit(
  client: Retell,
  opts: {
    agentId: string;
    llmId: string;
    expectedWebhookUrl: string;
  },
): Promise<{ toolsOk: boolean; toolsDetail: string; agent: AgentResponse }> {
  const agent = await client.agent.retrieve(opts.agentId);
  const llm = await client.llm.retrieve(opts.llmId);

  const webhookOk = urlsMatch(agent.webhook_url, opts.expectedWebhookUrl);
  const promptPresent = Boolean(llm.general_prompt && String(llm.general_prompt).trim().length > 0);
  const promptChars = llm.general_prompt ? String(llm.general_prompt).trim().length : 0;

  const customTools = (llm.general_tools ?? []).filter(isCustomTool);
  const names = new Set(customTools.map((t) => t.name));
  const expected = RECEPTIONIST_FUNCTION_SPECS.map((s) => s.slug);
  const missing = expected.filter((slug) => !names.has(slug));
  const toolsOk = missing.length === 0;
  const toolsDetail = toolsOk
    ? `yes (${customTools.length} custom tools, all ${expected.length} expected names present)`
    : `partial (${customTools.length} custom; missing: ${missing.join(', ') || '—'})`;

  console.log('\n=== Config audit (from Retell API after publish) ===\n');
  console.log(`  Webhook URL set     ${webhookOk ? 'yes' : 'no'}  ${agent.webhook_url ?? '(none)'}`);
  if (!webhookOk) {
    console.log(`    expected            ${opts.expectedWebhookUrl}`);
  }
  console.log(`  General prompt      ${promptPresent ? `yes (${promptChars} chars)` : 'no'}`);
  console.log(`  Begin message       ${llm.begin_message ? 'yes' : 'no'}`);
  console.log(`  Custom tools        ${toolsDetail}`);
  console.log(`  Voice on agent      ${agent.voice_id ? `yes (${agent.voice_id})` : 'no'}`);
  const engine = agent.response_engine;
  const linkedLlm =
    engine?.type === 'retell-llm' && 'llm_id' in engine && engine.llm_id === opts.llmId;
  console.log(`  LLM linked          ${linkedLlm ? `yes (${opts.llmId})` : 'check dashboard'}`);
  console.log('');

  return { toolsOk, toolsDetail, agent };
}

async function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));

  loadEnv({ path: path.join(repoRoot, '.env'), quiet: true });
  loadEnv({ path: path.join(repoRoot, '.env.local'), override: true, quiet: true });

  const apiKey = requireEnv('RETELL_API_KEY');
  const appBase = normalizeBaseUrl(requireEnv('APP_BASE_URL'));
  const toolSecret = requireEnv('RETELL_TOOL_SHARED_SECRET');

  console.log(`[retell:setup] RETELL_API_KEY=${maskSecret(apiKey)}`);
  console.log(`[retell:setup] APP_BASE_URL=${appBase}`);
  console.log(`[retell:setup] RETELL_TOOL_SHARED_SECRET=${maskSecret(toolSecret)}`);

  const client = new Retell({ apiKey });

  const llmIdPreset = process.env.RETELL_LLM_ID?.trim() || '';
  const agentIdPreset = process.env.RETELL_AGENT_ID?.trim() || '';
  console.log(
    `[retell:setup] Idempotency: LLM=${llmIdPreset ? `update ${llmIdPreset}` : 'create'}; Agent=${agentIdPreset ? `update ${agentIdPreset}` : 'create'}`,
  );

  const generalPrompt = resolvePromptFromRepo(repoRoot);
  const tools = buildRetellCustomTools(appBase, toolSecret);
  const modelChoice = parseLlmModelChoice();
  const llmBody = buildLlmPayload(generalPrompt, tools, modelChoice);

  const webhookUrl = retellWebhookUrl(appBase);
  const timezone = process.env.RECEPTIONIST_DEFAULT_TIMEZONE?.trim() || 'America/Toronto';
  const agentName = process.env.RETELL_AGENT_NAME?.trim() || 'WNY Automation Portal Receptionist';

  let llmId = llmIdPreset;
  if (llmId) {
    console.log(`[retell:setup] Updating existing LLM ${llmId}…`);
    await client.llm.update(llmId, llmBody as LlmUpdateParams);
  } else {
    console.log('[retell:setup] Creating new Retell LLM…');
    const created = await client.llm.create(llmBody);
    llmId = created.llm_id;
    console.log(`[retell:setup] Created LLM ${llmId}`);
  }

  const voiceId = await pickVoiceId(client, process.env.RETELL_VOICE_ID?.trim() || null);

  const agentPatch = buildAgentPayload(llmId, voiceId, webhookUrl, agentName, timezone);

  let agentId = agentIdPreset;
  let agentVersion: number;
  if (agentId) {
    console.log(`[retell:setup] Updating agent ${agentId}…`);
    const updated = await client.agent.update(agentId, agentPatch);
    agentVersion = updated.version;
  } else {
    console.log('[retell:setup] Creating new voice agent…');
    const createBody: AgentCreateParams = {
      ...agentPatch,
      response_engine: { type: 'retell-llm', llm_id: llmId },
      voice_id: voiceId,
    };
    const created = await client.agent.create(createBody);
    agentId = created.agent_id;
    agentVersion = created.version;
    console.log(`[retell:setup] Created agent ${agentId}`);
  }

  console.log('[retell:setup] Publishing agent (SDK typed publish + raw response — tolerates empty JSON body)…');
  const publishRes = await publishAgentWithoutJsonBody(client, agentId, agentVersion);
  const publishStatusLabel =
    publishRes.status === 204
      ? '204 No Content'
      : `HTTP ${publishRes.status}${publishRes.headers.get('content-length') === '0' ? ', zero-length body' : ''}`;
  console.log(`[retell:setup] Publish request OK (${publishStatusLabel}).`);

  const { toolsOk, toolsDetail, agent: agentSnapshot } = await logPublishedConfigAudit(client, {
    agentId,
    llmId,
    expectedWebhookUrl: webhookUrl,
  });

  if (!args.skipDocs) {
    writeGeneratedDocs(repoRoot, { appBasePlaceholder: appBase });
    console.log('[retell:setup] Wrote docs/receptionist/retell-functions.generated.{md,json} and retell-agent-script.generated.md');
  }

  const needsAgent = !readEnvValue(repoRoot, 'RETELL_AGENT_ID');
  const needsLlm = !readEnvValue(repoRoot, 'RETELL_LLM_ID');
  if (args.writeEnv && (needsAgent || needsLlm)) {
    const toWrite: Record<string, string> = {};
    if (needsAgent) toWrite.RETELL_AGENT_ID = agentId;
    if (needsLlm) toWrite.RETELL_LLM_ID = llmId;
    upsertEnvLocal(repoRoot, toWrite);
  } else if (args.writeEnv) {
    console.log('[retell:setup] .env.local already contains RETELL_AGENT_ID and RETELL_LLM_ID — no env write.');
  } else if (needsAgent || needsLlm) {
    console.log('\n[retell:setup] Tip: rerun with --write-env to append missing RETELL_AGENT_ID / RETELL_LLM_ID to .env.local (backup created).');
  }

  printSuccessSummary({
    'Agent ID': agentId,
    'LLM ID': llmId,
    'Webhook URL': webhookUrl,
    'Voice ID': voiceId,
    'Tools configured': toolsOk
      ? `yes (${RECEPTIONIST_FUNCTION_SPECS.length} WNY Automation Portal functions)`
      : `no — ${toolsDetail}`,
  });
  console.log(
    `  (Retell reports agent version ${String(agentSnapshot.version ?? '?')}, is_published=${String(agentSnapshot.is_published ?? '?')})`,
  );
  if (agentSnapshot.is_published === false) {
    console.warn(
      '[retell:setup] WARNING: Retell reports is_published=false. Confirm in the Retell dashboard before relying on this agent for production or demo phone numbers.',
    );
  }
  if (!toolsOk) {
    console.warn(
      '[retell:setup] WARNING: Published agent tool audit did not fully match expectations. Verify custom tool URLs and RETELL_TOOL_SHARED_SECRET before live traffic.',
    );
  }
  console.log('');

  console.log('=== Manual steps (if any) ===');
  console.log('- Twilio / SIP trunk → WNY Automation Portal voice webhook remains a separate configuration (see docs/RECEPTIONIST_RETELL.md).');
  console.log('- Confirm billing / quotas in the Retell dashboard.');
  console.log('- If you rotated RETELL_TOOL_SHARED_SECRET, rerun this script so custom tool headers update.');
  console.log('');
}

main().catch((err) => {
  console.error('[retell:setup] Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
