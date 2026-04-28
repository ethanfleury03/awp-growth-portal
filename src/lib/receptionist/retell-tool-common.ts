import { sql } from '@/lib/db';
import type { ReceptionistCallMeta } from '@/lib/receptionist/hardening/types';
import {
  findRetellBrowserToolFallbackCallId,
  insertReceptionistToolInvocation,
  mergeReceptionistMetaPartial,
} from '@/lib/receptionist/repository';
import type { ExtractedCallData } from '@/lib/receptionist/types';

export function verifyRetellToolSecret(request: Request): boolean {
  const secret = process.env.RETELL_TOOL_SHARED_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const headerSecret = request.headers.get('x-retell-tool-secret');
  return bearer === secret || headerSecret === secret;
}

function retellToolDebugEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.RECEPTIONIST_TOOL_DEBUG === 'true';
}

/** Safe stringify for logs (cap length). */
function previewJson(value: unknown, max = 2500): string {
  try {
    const s = JSON.stringify(value);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return '[unserializable]';
  }
}

/**
 * Logs headers (no secrets), raw + normalized body in development or when RECEPTIONIST_TOOL_DEBUG=true.
 */
export function logRetellToolDebug(
  routeLabel: string,
  request: Request,
  detail: {
    rawBody?: unknown;
    normalizedBody?: Record<string, unknown>;
    message?: string;
    resolveError?: string;
  },
) {
  if (!retellToolDebugEnabled()) return;
  const headers: Record<string, string | null> = {
    'content-type': request.headers.get('content-type'),
    authorization: request.headers.get('authorization') ? '[set]' : null,
    'x-retell-tool-secret': request.headers.get('x-retell-tool-secret') ? '[set]' : null,
  };
  console.info(`[retell-tool:${routeLabel}]`, {
    headers,
    message: detail.message,
    resolveError: detail.resolveError,
    rawBody: detail.rawBody !== undefined ? previewJson(detail.rawBody) : undefined,
    normalizedBody: detail.normalizedBody ? previewJson(detail.normalizedBody) : undefined,
  });
}

function toOptionalString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

/**
 * Retell sometimes sends tool args nested (`args`, `arguments`, `params`) or uses camelCase / synonyms.
 * Merge onto a flat object so routes can keep reading top-level fields.
 */
export function normalizeRetellToolBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const o = input as Record<string, unknown>;
  const nested =
    (o.args && typeof o.args === 'object' && !Array.isArray(o.args) ? o.args : null) ||
    (o.arguments && typeof o.arguments === 'object' && !Array.isArray(o.arguments) ? o.arguments : null) ||
    (o.tool_arguments && typeof o.tool_arguments === 'object' && !Array.isArray(o.tool_arguments)
      ? o.tool_arguments
      : null) ||
    (o.params && typeof o.params === 'object' && !Array.isArray(o.params) ? o.params : null);

  const out: Record<string, unknown> = { ...o };
  if (nested) {
    Object.assign(out, nested as Record<string, unknown>);
  }

  const alias = (from: string, to: string) => {
    if (out[to] === undefined || out[to] === null || out[to] === '') {
      const v = out[from];
      if (v !== undefined && v !== null && v !== '') out[to] = v;
    }
  };
  alias('callId', 'call_id');
  alias('retell_call_id', 'call_id');
  alias('interaction_id', 'call_id');
  alias('conversation_id', 'call_id');
  alias('receptionistCallId', 'receptionist_call_id');
  alias('plumber_call_id', 'receptionist_call_id');
  alias('internal_call_id', 'receptionist_call_id');

  if (out.call_id !== undefined && out.call_id !== null) {
    const s = toOptionalString(out.call_id);
    if (s) out.call_id = s;
  }
  if (out.receptionist_call_id !== undefined && out.receptionist_call_id !== null) {
    const s = toOptionalString(out.receptionist_call_id);
    if (s) out.receptionist_call_id = s;
  }

  return out;
}

function truthyRetell(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === 'yes';
}

/** Maps agent read-back / confirmation flags from tool payload into receptionist_meta_json. */
export function confirmationMetaPatchFromRetellToolBody(body: Record<string, unknown>): Partial<ReceptionistCallMeta> {
  const b = normalizeRetellToolBody(body);
  return {
    confirmations: {
      callback_phone_readback:
        truthyRetell(b.caller_confirmed_phone) ||
        truthyRetell(b.phone_confirmed) ||
        truthyRetell(b.callback_number_confirmed),
      callback_window_readback:
        truthyRetell(b.callback_window_confirmed) || truthyRetell(b.window_confirmed),
      visit_address_readback:
        truthyRetell(b.address_confirmed) || truthyRetell(b.service_address_confirmed),
      visit_window_readback: truthyRetell(b.visit_window_confirmed),
      issue_clarified: truthyRetell(b.issue_confirmed) || truthyRetell(b.problem_confirmed),
    },
  };
}

export async function mergeRetellToolConfirmationsOntoCall(callId: string, body: Record<string, unknown>) {
  await mergeReceptionistMetaPartial(callId, confirmationMetaPatchFromRetellToolBody(body));
}

export async function readRetellToolJson(request: Request, routeLabel: string): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    const text = await request.text();
    if (!text.trim()) {
      logRetellToolDebug(routeLabel, request, { rawBody: null, message: 'empty body' });
      return {};
    }
    raw = JSON.parse(text) as unknown;
  } catch (e) {
    logRetellToolDebug(routeLabel, request, {
      message: 'JSON parse failed',
      resolveError: e instanceof Error ? e.message : String(e),
    });
    return {};
  }
  const normalized = normalizeRetellToolBody(raw);
  logRetellToolDebug(routeLabel, request, { rawBody: raw, normalizedBody: normalized });
  return normalized;
}

function isPresentRetellBindingValue(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  const s = String(v).trim();
  if (!s) return false;
  if (s.toLowerCase() === 'null') return false;
  return true;
}

/** True if the agent sent any non-empty call binding field (after normalizing nested args). */
export function hasExplicitRetellCallBindingAttempt(body: Record<string, unknown>): boolean {
  const b = normalizeRetellToolBody(body);
  const keys = [
    'receptionist_call_id',
    'receptionistCallId',
    'plumber_call_id',
    'call_id',
    'callId',
    'retell_call_id',
    'interaction_id',
    'conversation_id',
  ];
  return keys.some((k) => isPresentRetellBindingValue(b[k]));
}

async function resolveExplicitPlumberCallIdFromNormalizedBody(
  b: Record<string, unknown>,
): Promise<string | undefined> {
  const recv =
    toOptionalString(b.receptionist_call_id) ||
    toOptionalString(b.receptionistCallId) ||
    toOptionalString(b.plumber_call_id);
  if (recv) {
    const rows = await sql`SELECT id FROM receptionist_calls WHERE id = ${recv} LIMIT 1`;
    if (rows.length) return recv;
  }

  const retellIds = [
    toOptionalString(b.call_id),
    toOptionalString(b.callId),
    toOptionalString(b.retell_call_id),
    toOptionalString(b.interaction_id),
    toOptionalString(b.conversation_id),
  ].filter((x): x is string => Boolean(x));

  const seen = new Set<string>();
  for (const cid of retellIds) {
    if (seen.has(cid)) continue;
    seen.add(cid);
    const rows = await sql`
      SELECT id FROM receptionist_calls WHERE provider_call_id = ${cid} LIMIT 1
    `;
    if (rows.length) return rows[0].id as string;
  }

  return undefined;
}

/**
 * Resolves WNY Automation Portal receptionist_calls.id from Retell tool payloads.
 * Twilio-backed calls: explicit call_id / receptionist_call_id (unchanged).
 * Browser test: when all IDs are null/omitted, uses a unique Retell row without twilio_call_sid
 * (active, ringing, or recently completed — so end_call_notes still binds after call_ended).
 * (see findRetellBrowserToolFallbackCallId). Webhook must have run first to create that row from call.call_id.
 */
export async function resolvePlumberCallIdFromToolBody(
  body: Record<string, unknown>,
  routeLabel = 'retell_tool',
): Promise<string | undefined> {
  const b = normalizeRetellToolBody(body);
  const explicitAttempt = hasExplicitRetellCallBindingAttempt(body);

  const direct = await resolveExplicitPlumberCallIdFromNormalizedBody(b);
  if (direct) {
    if (retellToolDebugEnabled()) {
      console.info(`[retell-tool:${routeLabel}] resolution via=explicit_body plumber_call_id=${direct}`);
    }
    return direct;
  }

  if (explicitAttempt) {
    if (retellToolDebugEnabled()) {
      console.info(
        `[retell-tool:${routeLabel}] resolution via=none (explicit call binding present but no matching DB row)`,
      );
    }
    return undefined;
  }

  const fb = await findRetellBrowserToolFallbackCallId();
  if (fb) {
    console.info(`[retell-tool:${routeLabel}] fallback_match via=${fb.reason} plumber_call_id=${fb.id}`);
    return fb.id;
  }

  if (retellToolDebugEnabled()) {
    console.info(
      `[retell-tool:${routeLabel}] resolution via=none (no explicit id; no unique retell browser fallback row)`,
    );
  }
  return undefined;
}

export async function auditTool(
  callId: string | undefined,
  toolName: string,
  requestJson: unknown,
  responseJson: unknown,
  status: string,
) {
  if (!callId) return;
  await insertReceptionistToolInvocation({
    callId,
    toolName,
    requestJson,
    responseJson,
    status,
  });
}

export function toolJsonError(message: string, code: string) {
  return { ok: false as const, error: { code, message } };
}

export function toolJsonOk<T extends Record<string, unknown>>(data: T) {
  return { ok: true as const, ...data };
}

function coerceUrgency(v: unknown): ExtractedCallData['urgency'] {
  const s = toOptionalString(v)?.toLowerCase();
  if (s === 'low' || s === 'medium' || s === 'high' || s === 'emergency') return s;
  return 'medium';
}

/** User-visible hint when WNY Automation Portal cannot map the Retell payload to a row (dev shows keys). */
export function unknownRetellCallMessage(body: Record<string, unknown>): string {
  const base =
    'Unknown call — include call_id (Retell) and/or receptionist_call_id (WNY Automation Portal). Tool args may be nested under args.';
  if (!retellToolDebugEnabled()) return base;
  const keys = Object.keys(body);
  return `${base} (received keys: ${keys.length ? keys.join(', ') : 'none'})`;
}

export function partialExtractedFromToolArgs(args: Record<string, unknown>): Partial<ExtractedCallData> {
  const preferredCallbackWindow =
    toOptionalString(args.preferred_callback_window) ||
    toOptionalString(args.time_preference) ||
    toOptionalString(args.callback_window) ||
    toOptionalString(args.preferred_time) ||
    toOptionalString(args.when) ||
    toOptionalString(args.callback_time) ||
    null;

  const preferredVisitWindow =
    toOptionalString(args.preferred_visit_window) ||
    toOptionalString(args.visit_window) ||
    toOptionalString(args.appointment_window) ||
    null;

  return {
    callerName: toOptionalString(args.caller_name) || toOptionalString(args.callerName) || null,
    phone: toOptionalString(args.phone) || toOptionalString(args.callback_number) || null,
    address: toOptionalString(args.address) || toOptionalString(args.service_address) || null,
    issueType: toOptionalString(args.issue_type) || null,
    issueDescription:
      toOptionalString(args.issue_description) || toOptionalString(args.issue) || toOptionalString(args.problem) || null,
    urgency: coerceUrgency(args.urgency),
    preferredCallbackWindow,
    preferredVisitWindow,
  };
}

/** Notes text for end_call_notes — tolerate natural language field names from the agent. */
export function notesFromRetellToolBody(body: Record<string, unknown>): string {
  return (
    toOptionalString(body.notes) ||
    toOptionalString(body.summary) ||
    toOptionalString(body.note) ||
    toOptionalString(body.message) ||
    toOptionalString(body.internal_notes) ||
    toOptionalString(body.call_notes) ||
    toOptionalString(body.memo) ||
    ''
  );
}

export async function mergeExtractedOntoCall(callId: string, partial: Partial<ExtractedCallData>) {
  const rows = await sql`SELECT extracted_json FROM receptionist_calls WHERE id = ${callId}`;
  let base: Record<string, unknown> = {};
  const raw = rows[0]?.extracted_json as string | undefined;
  if (raw) {
    try {
      base = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      base = {};
    }
  }
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(partial)) {
    if (v !== undefined) patch[k] = v;
  }
  const next = { ...base, ...patch };
  await sql`
    UPDATE receptionist_calls SET extracted_json = ${JSON.stringify(next)}, updated_at = datetime('now')
    WHERE id = ${callId}
  `;
}
