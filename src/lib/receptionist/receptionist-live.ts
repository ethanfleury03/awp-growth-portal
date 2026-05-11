import Retell, { verify as verifyRetellWebhook } from 'retell-sdk';
import Twilio from 'twilio';
import { sql } from '@/lib/db';
import {
  attachRetellRegistrationToCall,
  createInboundRetellCallRow,
  ensureReceptionistCallForRetellBrowserSession,
  ensureReceptionistSettings,
  findReceptionistCallByRetellCallId,
  findReceptionistCallByTwilioSid,
  logReceptionistEvent,
  persistReceptionistHardeningForCall,
} from '@/lib/receptionist/repository';
import {
  createCallLogForReceptionistCall,
  getCompanyIdForReceptionist,
  linkReceptionistCallToCallLog,
} from '@/lib/receptionist/integrations';
import {
  decideDisposition,
  dispositionToRecommendedStep,
  extractCallFieldsFromTranscript,
  parseEmergencyKeywordsJson,
} from '@/lib/receptionist/extract';
import type { ReceptionistDisposition } from '@/lib/receptionist/types';

const SIP_HOST = 'sip.retellai.com';

function devBypassTwilio() {
  return process.env.RECEPTIONIST_DEV_BYPASS_TWILIO_SIGNATURE === 'true';
}

function tunnelHostLooksHttps(host: string): boolean {
  return /\.ngrok-free\.(app|dev)$|\.ngrok\.io$/i.test(host.trim());
}

/**
 * Path + query from the incoming request (stable regardless of public vs internal host).
 */
function requestPathAndSearch(requestUrl: string): { pathname: string; search: string } {
  try {
    const u = new URL(requestUrl);
    return { pathname: u.pathname, search: u.search };
  } catch {
    return { pathname: '/', search: '' };
  }
}

/**
 * Full URL Twilio used when signing `X-Twilio-Signature`. Use this for `validateRequest`.
 *
 * Order: `TWILIO_WEBHOOK_PUBLIC_URL` + path → `x-forwarded-*` / `Forwarded` (ngrok, load balancers)
 * → raw `request.url` (works only if the app sees the same host Twilio posted to).
 */
export function getTwilioWebhookUrlForSignature(request: Request): string {
  const { pathname, search } = requestPathAndSearch(request.url);
  const suffix = `${pathname}${search}`;

  const envBase = process.env.TWILIO_WEBHOOK_PUBLIC_URL?.replace(/\/$/, '');
  if (envBase) return `${envBase}${suffix}`;

  const h = request.headers;
  const xfHost = h.get('x-forwarded-host')?.split(',')[0]?.trim();
  let xfProto = h.get('x-forwarded-proto')?.split(',')[0]?.trim();

  if (xfHost) {
    if (!xfProto && tunnelHostLooksHttps(xfHost)) xfProto = 'https';
    if (xfProto) return `${xfProto}://${xfHost}${suffix}`;
  }

  const forwarded = h.get('forwarded');
  if (forwarded) {
    const hostMatch = /host=([^;,\s]+)/i.exec(forwarded);
    const protoMatch = /proto=([^;,\s]+)/i.exec(forwarded);
    const fh = hostMatch?.[1]?.replace(/^"|"$/g, '').trim();
    let fp = protoMatch?.[1]?.replace(/^"|"$/g, '').trim();
    if (fh) {
      if (!fp && tunnelHostLooksHttps(fh)) fp = 'https';
      if (fp) return `${fp}://${fh}${suffix}`;
    }
  }

  // Some tunnels preserve the public hostname in `Host` (not always true for ngrok → localhost).
  const hostHeader = h.get('host')?.split(',')[0]?.trim();
  if (hostHeader && tunnelHostLooksHttps(hostHeader)) {
    return `https://${hostHeader}${suffix}`;
  }

  return request.url;
}

/**
 * @deprecated Prefer {@link getTwilioWebhookUrlForSignature} with the full `Request`.
 */
export function resolveTwilioWebhookUrl(requestUrl: string): string {
  const base = process.env.TWILIO_WEBHOOK_PUBLIC_URL?.replace(/\/$/, '');
  if (!base) return requestUrl;
  try {
    const u = new URL(requestUrl);
    return `${base}${u.pathname}${u.search}`;
  } catch {
    return requestUrl;
  }
}

function devBypassRetell() {
  return process.env.RECEPTIONIST_DEV_BYPASS_RETELL_SIGNATURE === 'true';
}

function shouldVerifyRetell() {
  if (devBypassRetell()) return false;
  return process.env.RETELL_VERIFY_WEBHOOKS !== 'false';
}

function shouldVerifyTwilio() {
  if (devBypassTwilio()) return false;
  return process.env.TWILIO_VERIFY_SIGNATURES !== 'false';
}

export function getAppBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    'http://localhost:3003'
  ).replace(/\/$/, '');
}

export function verifyTwilioRequest(
  signature: string | null,
  fullUrl: string,
  params: Record<string, string>,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const isProd = process.env.NODE_ENV === 'production';

  if (devBypassTwilio() && isProd && token) {
    console.warn(
      '[receptionist-live] RECEPTIONIST_DEV_BYPASS_TWILIO_SIGNATURE=true in production while TWILIO_AUTH_TOKEN is set — webhook signatures are not verified.',
    );
  }

  if (!shouldVerifyTwilio()) return true;
  if (!token || !signature) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[receptionist-live] Twilio signature check failed: missing TWILIO_AUTH_TOKEN or x-twilio-signature (set TWILIO_VERIFY_SIGNATURES=false only for local debugging).',
      );
    }
    return false;
  }
  const ok = Twilio.validateRequest(token, signature, fullUrl, params);
  if (!ok && process.env.NODE_ENV === 'development') {
    console.warn('[receptionist-live] Twilio validateRequest returned false', {
      fullUrl,
      keys: Object.keys(params),
      hint: 'Behind ngrok: ensure TWILIO_AUTH_TOKEN matches this Twilio account; set TWILIO_WEBHOOK_PUBLIC_URL to your ngrok https origin if forwarded headers are missing.',
    });
  }
  return ok;
}

export function verifyTwilioVoiceRequest(
  signature: string | null,
  fullUrl: string,
  params: Record<string, string>,
): boolean {
  return verifyTwilioRequest(signature, fullUrl, params);
}

export async function verifyRetellSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const key = process.env.RETELL_API_KEY;
  if (!shouldVerifyRetell()) return true;
  if (!key || !signature) return false;
  return verifyRetellWebhook(rawBody, key, signature);
}

function getRetellClient() {
  const key = process.env.RETELL_API_KEY;
  if (!key) throw new Error('RETELL_API_KEY is not set');
  return new Retell({ apiKey: key });
}

function transcriptFromRetellCall(call: Record<string, unknown>): string {
  const t = call.transcript;
  if (typeof t === 'string' && t.trim()) return t;
  const obj = call.transcript_object;
  if (!Array.isArray(obj)) return '';
  return obj
    .map((u: { role?: string; content?: string }) => {
      const role = u.role === 'agent' ? 'Assistant' : u.role === 'user' ? 'Caller' : u.role || 'unknown';
      return `${role}: ${u.content ?? ''}`;
    })
    .join('\n');
}

function parseMetadataReceptionistId(call: Record<string, unknown>): string | undefined {
  const meta = call.metadata;
  if (meta && typeof meta === 'object' && meta !== null && 'receptionist_call_id' in meta) {
    const v = (meta as { receptionist_call_id?: string }).receptionist_call_id;
    if (typeof v === 'string') return v;
  }
  return undefined;
}

async function resolvePlumberCallIdForRetell(retellCallId: string, call: Record<string, unknown>) {
  const byRetell = await findReceptionistCallByRetellCallId(retellCallId);
  if (byRetell) return byRetell.id as string;
  const fromMeta = parseMetadataReceptionistId(call);
  if (fromMeta) {
    const rows = await sql`SELECT id FROM receptionist_calls WHERE id = ${fromMeta} LIMIT 1`;
    if (rows.length) return fromMeta;
  }
  return undefined;
}

export async function handleTwilioInboundVoice(params: {
  twilioCallSid: string;
  from: string;
  to: string;
  signature: string | null;
  /** Full URL Twilio signed (see {@link getTwilioWebhookUrlForSignature}). */
  webhookUrlForSignature: string;
  /** Full Twilio POST fields (required for signature validation). */
  formParams: Record<string, string>;
}): Promise<{ twiml: string; status: number; error?: string }> {
  // Twilio treats non-2xx as webhook failure (11200) and will not run TwiML — callers only hear the generic
  // "application error" prompt. Always return 200 when sending TwiML (including error <Say> flows).
  if (!verifyTwilioVoiceRequest(params.signature, params.webhookUrlForSignature, params.formParams)) {
    return {
      twiml: twimlReject('Sorry, we could not connect this call. Please try again later.'),
      status: 200,
      error: 'twilio_signature_invalid',
    };
  }

  const companyIdForCall = await getCompanyIdForReceptionist(params.to);
  const settings = await ensureReceptionistSettings(companyIdForCall);
  const agentId =
    (settings.retell_agent_id && settings.retell_agent_id.trim()) ||
    process.env.RETELL_AGENT_ID ||
    '';
  if (!agentId) {
    return {
      twiml: twimlReject('Receptionist agent not configured. Please try again later.'),
      status: 200,
      error: 'retell_agent_missing',
    };
  }

  let row = await findReceptionistCallByTwilioSid(params.twilioCallSid);
  if (!row) {
    row = await createInboundRetellCallRow({
      twilioCallSid: params.twilioCallSid,
      fromPhone: params.from,
      toPhone: params.to,
      companyId: companyIdForCall,
    });
    await logReceptionistEvent(row.id as string, 'twilio_inbound', { CallSid: params.twilioCallSid }, 'twilio');
  }

  const plumberId = row.id as string;
  let retellCallId = row.provider_call_id as string | null;

  if (!retellCallId) {
    try {
      const client = getRetellClient();
      const registered = await client.call.registerPhoneCall({
        agent_id: agentId,
        from_number: params.from,
        to_number: params.to,
        direction: 'inbound',
        metadata: {
          receptionist_call_id: plumberId,
          company_name: settings.company_name,
        },
      });
      retellCallId = registered.call_id;
      await attachRetellRegistrationToCall(plumberId, {
        retellCallId,
        agentId,
        providerStatus: registered.call_status,
        rawPayload: registered,
      });
      await logReceptionistEvent(
        plumberId,
        'retell_registered',
        { call_id: retellCallId, call_status: registered.call_status },
        'retell',
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Retell registration failed';
      console.error('[receptionist-live] registerPhoneCall failed:', msg, e);
      return { twiml: twimlReject('Unable to connect AI line. Please try again later.'), status: 200, error: msg };
    }
  }

  const sipUri = `sip:${retellCallId}@${SIP_HOST}`;
  return { twiml: twimlDialSip(sipUri), status: 200 };
}

function twimlDialSip(sipUri: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial><Sip>${escapeXml(sipUri)}</Sip></Dial></Response>`;
}

function twimlReject(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function handleTwilioStatusCallback(form: URLSearchParams) {
  const sid = form.get('CallSid');
  const status = form.get('CallStatus');
  if (!sid) return;
  const row = await findReceptionistCallByTwilioSid(sid);
  if (!row) return;
  await logReceptionistEvent(row.id as string, 'twilio_status', { CallStatus: status }, 'twilio');
}

export async function handleRetellWebhook(rawBody: string, signature: string | null): Promise<{ ok: boolean; status: number }> {
  if (!(await verifyRetellSignature(rawBody, signature))) {
    return { ok: false, status: 401 };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400 };
  }

  const event = String(body.event || '').toLowerCase();
  const call = (body.call as Record<string, unknown>) || (body as { call?: Record<string, unknown> }).call;
  if (!call || typeof call.call_id !== 'string') {
    return { ok: true, status: 204 };
  }

  const retellCallId = call.call_id as string;
  let plumberId = await resolvePlumberCallIdForRetell(retellCallId, call);
  if (!plumberId) {
    const ensured = await ensureReceptionistCallForRetellBrowserSession(retellCallId, call);
    plumberId = ensured.id;
    if (ensured.created) {
      console.info(
        `[retell-webhook] ensured receptionist_calls row: Retell correlation key call.call_id=${retellCallId} -> WNY Automation Portal id=${plumberId} (stored as provider_call_id). Twilio inbound path unchanged.`,
      );
    }
  }

  await logReceptionistEvent(plumberId, `retell_${event || 'unknown'}`, body, 'retell');

  const transcript = transcriptFromRetellCall(call);
  const callStatus = call.call_status as string | undefined;
  const recording = (call.recording_url as string) || null;

  const liveStatuses = new Set(['ongoing', 'registered', 'not_connected']);
  const nextAppStatus = callStatus && liveStatuses.has(callStatus) ? 'active' : undefined;

  if (
    event.includes('transcript') ||
    event === 'call_updated' ||
    event === 'call_started' ||
    event === 'call_ended' ||
    transcript
  ) {
    if (nextAppStatus) {
      await sql`
        UPDATE receptionist_calls SET
          transcript_text = COALESCE(${transcript || null}, transcript_text),
          provider_status = ${callStatus || null},
          recording_url = COALESCE(${recording}, recording_url),
          raw_provider_payload_json = ${JSON.stringify(call)},
          status = ${nextAppStatus},
          updated_at = datetime('now')
        WHERE id = ${plumberId}
      `;
    } else {
      await sql`
        UPDATE receptionist_calls SET
          transcript_text = COALESCE(${transcript || null}, transcript_text),
          provider_status = ${callStatus || null},
          recording_url = COALESCE(${recording}, recording_url),
          raw_provider_payload_json = ${JSON.stringify(call)},
          updated_at = datetime('now')
        WHERE id = ${plumberId}
      `;
    }
  }

  if (event === 'call_ended' || callStatus === 'ended' || callStatus === 'error') {
    await finalizeLiveRetellCall(plumberId, call);
  }

  if (event === 'call_analyzed') {
    await mergeRetellAnalysis(plumberId, call);
  }

  return { ok: true, status: 204 };
}

async function mergeRetellAnalysis(plumberCallId: string, call: Record<string, unknown>) {
  const analysis = call.call_analysis as
    | { call_summary?: string; custom_analysis_data?: unknown }
    | undefined;
  const summary = analysis?.call_summary || (call.call_summary as string) || null;
  const custom = analysis?.custom_analysis_data;

  let extractedPatch: Record<string, unknown> = {};
  if (custom && typeof custom === 'object' && custom !== null) {
    extractedPatch = custom as Record<string, unknown>;
  }

  const existing = await sql`SELECT extracted_json, transcript_text FROM receptionist_calls WHERE id = ${plumberCallId}`;
  const row = existing[0] as Record<string, unknown> | undefined;
  let mergedExtracted = extractedPatch;
  if (row?.extracted_json && typeof row.extracted_json === 'string') {
    try {
      mergedExtracted = { ...JSON.parse(row.extracted_json), ...extractedPatch };
    } catch {
      mergedExtracted = extractedPatch;
    }
  }

  await sql`
    UPDATE receptionist_calls SET
      ai_summary = COALESCE(${summary}, ai_summary),
      extracted_json = ${JSON.stringify(mergedExtracted)},
      raw_provider_payload_json = ${JSON.stringify(call)},
      updated_at = datetime('now')
    WHERE id = ${plumberCallId}
  `;
}

async function finalizeLiveRetellCall(plumberCallId: string, call: Record<string, unknown>) {
  const statusRow = await sql`SELECT status FROM receptionist_calls WHERE id = ${plumberCallId}`;
  if (statusRow[0]?.status === 'completed') return;

  const settings = await ensureReceptionistSettings();
  const transcript = transcriptFromRetellCall(call) || (await getTranscriptFromDb(plumberCallId));
  const keywords = parseEmergencyKeywordsJson(settings.emergency_keywords_json);
  const extracted = extractCallFieldsFromTranscript(transcript, null, keywords);
  const analysis = call.call_analysis as { call_summary?: string; custom_analysis_data?: unknown } | undefined;
  if (analysis?.call_summary) {
    extracted.summary = analysis.call_summary;
  }
  if (analysis?.custom_analysis_data && typeof analysis.custom_analysis_data === 'object' && analysis.custom_analysis_data) {
    Object.assign(extracted as object, analysis.custom_analysis_data as object);
  }

  const durationMs = typeof call.duration_ms === 'number' ? call.duration_ms : Number(call.duration_ms || 0);
  const durationSeconds = Math.max(0, Math.round(durationMs / 1000));

  const disposition = decideDisposition(extracted, null);
  const recommended = dispositionToRecommendedStep(disposition, extracted);
  const aiSummary =
    (analysis?.call_summary && String(analysis.call_summary).trim()) || extracted.summary;

  await sql`
    UPDATE receptionist_calls SET
      transcript_text = ${transcript},
      extracted_json = ${JSON.stringify(extracted)},
      ai_summary = ${aiSummary},
      recommended_next_step = ${recommended},
      disposition = ${disposition},
      urgency = ${extracted.urgency},
      provider_status = ${(call.call_status as string) || 'ended'},
      status = 'completed',
      ended_at = datetime('now'),
      duration_seconds = ${durationSeconds},
      recording_url = COALESCE(${(call.recording_url as string) || null}, recording_url),
      raw_provider_payload_json = ${JSON.stringify(call)},
      updated_at = datetime('now')
    WHERE id = ${plumberCallId}
  `;

  await persistReceptionistHardeningForCall(plumberCallId);
  const dispRow = await sql`SELECT disposition FROM receptionist_calls WHERE id = ${plumberCallId}`;
  const finalDisposition = (dispRow[0]?.disposition as ReceptionistDisposition) || disposition;
  await ensureCallLogForLiveCall(plumberCallId, extracted, transcript, finalDisposition, durationSeconds);
}

async function getTranscriptFromDb(plumberCallId: string) {
  const rows = await sql`SELECT transcript_text FROM receptionist_calls WHERE id = ${plumberCallId}`;
  return (rows[0]?.transcript_text as string) || '';
}

async function ensureCallLogForLiveCall(
  plumberCallId: string,
  extracted: ReturnType<typeof extractCallFieldsFromTranscript>,
  transcript: string,
  disposition: ReceptionistDisposition,
  durationSeconds: number,
) {
  const rows = await sql`SELECT call_log_id, from_phone, caller_name, lead_id, job_id FROM receptionist_calls WHERE id = ${plumberCallId}`;
  const row = rows[0] as Record<string, unknown>;
  if (row.call_log_id) return;

  const companyId = await getCompanyIdForReceptionist();
  const outcomeMap: Record<string, 'booked' | 'callback' | 'info' | 'not_interested'> = {
    quote_visit_booked: 'booked',
    callback_booked: 'booked',
    lead_created: 'callback',
    follow_up_needed: 'callback',
    emergency: 'callback',
    spam: 'not_interested',
  };

  const callLogId = await createCallLogForReceptionistCall({
    companyId,
    customerName: extracted.callerName,
    phoneNumber: (extracted.phone as string) || (row.from_phone as string) || 'unknown',
    durationSeconds,
    transcript,
    aiSummary: extracted.summary,
    outcome: outcomeMap[disposition] || 'info',
    leadId: (row.lead_id as string) || null,
    jobId: (row.job_id as string) || null,
    customerId: null,
    recording: false,
  });
  await linkReceptionistCallToCallLog(plumberCallId, callLogId);
}
