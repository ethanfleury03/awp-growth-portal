import type {
  BookingRulesExtended,
  CallerBehavior,
  EmergencyTier,
  FieldConfidence,
  FieldConfidenceEntry,
  FieldProvenance,
} from '@/lib/receptionist/hardening/types';

const DEFAULT_TZ = 'America/Toronto';

/** Canonical plumbing phrases for conservative STT repair suggestions. */
export const PLUMBING_VOCABULARY: { phrase: string; patterns: RegExp[] }[] = [
  { phrase: 'sink leak', patterns: [/sync\s*league/i, /sink\s*leek/i, /sync\s*leak/i] },
  { phrase: 'clogged drain', patterns: [/clogged?\s*drain/i, /clog\s*drain/i] },
  { phrase: 'burst pipe', patterns: [/burst\s*pype/i, /bursed?\s*pipe/i] },
  { phrase: 'leaking faucet', patterns: [/leak(?:ing)?\s*fauc?t/i] },
  { phrase: 'toilet clog', patterns: [/toilet\s*clog/i, /clogged?\s*toilet/i] },
  { phrase: 'sewer backup', patterns: [/sewer\s*back\s*up/i, /sewage\s*backup/i] },
  { phrase: 'no hot water', patterns: [/no\s*hot\s*water/i] },
  { phrase: 'water heater leak', patterns: [/water\s*heat(?:er)?\s*leak/i] },
  { phrase: 'frozen pipe', patterns: [/frozen\s*pipes?/i] },
];

const PLUMBING_KEYWORDS =
  /\b(leak|pipe|drain|toilet|sink|faucet|sewer|water heater|hot water|clog|flood|backup|basement|tub|shower|garbage disposal|sump|hose bib|valve)\b/i;

const SUSPICIOUS_SINGLE_TOKEN = /^[A-Za-z]{4,20}$/;

const DEFAULT_SPAM_PHRASES = [
  'car warranty',
  'extended warranty',
  'press 1',
  'free cruise',
  'your google listing',
  'seo services',
  'solar panel',
  'student loan',
  'credit card debt',
];

export function parseBookingRulesExtended(json: string | null | undefined): BookingRulesExtended {
  if (!json?.trim()) return { timezone: DEFAULT_TZ, duplicateWindowMinutes: 120 };
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return {
      minNoticeHours: typeof o.minNoticeHours === 'number' ? o.minNoticeHours : undefined,
      duplicateWindowMinutes:
        typeof o.duplicateWindowMinutes === 'number' ? o.duplicateWindowMinutes : 120,
      spamKeywords: Array.isArray(o.spamKeywords)
        ? (o.spamKeywords as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined,
      timezone: typeof o.timezone === 'string' ? o.timezone : DEFAULT_TZ,
      emergencyEscalation:
        o.emergencyEscalation === 'flag_only' || o.emergencyEscalation === 'flag_and_callback'
          ? o.emergencyEscalation
          : undefined,
      silenceTranscriptMaxChars:
        typeof o.silenceTranscriptMaxChars === 'number' ? o.silenceTranscriptMaxChars : undefined,
    };
  } catch {
    return { timezone: DEFAULT_TZ, duplicateWindowMinutes: 120 };
  }
}

function normalizeIssueText(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Heuristic: likely mis-transcription or useless label (e.g. SyncLeague).
 */
export function detectSuspiciousIssueDescription(issue: string | null | undefined): {
  suspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!issue || !issue.trim()) {
    reasons.push('missing_issue');
    return { suspicious: true, reasons };
  }
  const t = issue.trim();
  const n = normalizeIssueText(t);
  if (t.length < 6) {
    reasons.push('too_short');
  }
  if (SUSPICIOUS_SINGLE_TOKEN.test(t) && !PLUMBING_KEYWORDS.test(t)) {
    reasons.push('single_token_non_plumbing');
  }
  if (/^[A-Z][a-z]+[A-Z]/.test(t) && !PLUMBING_KEYWORDS.test(t)) {
    reasons.push('camel_case_product_like');
  }
  if (!PLUMBING_KEYWORDS.test(t) && t.split(/\s+/).length <= 2 && t.length < 40) {
    reasons.push('no_plumbing_keywords');
  }
  return { suspicious: reasons.length > 0, reasons };
}

export function tryNormalizeIssuePhrase(issue: string | null | undefined): {
  normalized: string | null;
  source: 'vocabulary_match' | 'none';
} {
  if (!issue?.trim()) return { normalized: null, source: 'none' };
  for (const { phrase, patterns } of PLUMBING_VOCABULARY) {
    for (const re of patterns) {
      if (re.test(issue)) return { normalized: phrase, source: 'vocabulary_match' };
    }
  }
  return { normalized: null, source: 'none' };
}

export function looksLikePhone(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  const d = s.replace(/\D/g, '');
  return d.length >= 10;
}

export function looksLikeServiceAddress(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  const t = s.trim();
  if (t.length < 12) return false;
  const hasStreetHint = /\b(st|street|ave|avenue|rd|road|dr|drive|lane|blvd|way|court|pl|unit|apt|#)\b/i.test(
    t,
  );
  const hasDigit = /\d/.test(t);
  return hasDigit && (hasStreetHint || t.length > 24);
}

export function collectSpamSignals(
  transcript: string,
  extraKeywords: string[] | undefined,
): string[] {
  const h = transcript.toLowerCase();
  const hits: string[] = [];
  for (const p of DEFAULT_SPAM_PHRASES) {
    if (h.includes(p)) hits.push(p);
  }
  for (const p of extraKeywords || []) {
    const n = p.trim().toLowerCase();
    if (n && h.includes(n)) hits.push(n);
  }
  if (/^\s*(robocall|telemarketer)\b/i.test(transcript)) hits.push('robocall_hint');
  return hits;
}

export function classifyEmergencyTier(params: {
  transcript: string;
  emergencyKeywords: string[];
  spamSignals: string[];
}): { tier: EmergencyTier; rationale: string[]; hasPlumbingContent: boolean } {
  const h = params.transcript.toLowerCase();
  const emergencyRationale: string[] = [];
  for (const phrase of params.emergencyKeywords) {
    const p = phrase.trim().toLowerCase();
    if (p && h.includes(p)) emergencyRationale.push(`emergency_keyword:${p}`);
  }
  const hasPlumbingContent = PLUMBING_KEYWORDS.test(h);
  const urgentHints = ['urgent', 'asap', 'today', 'right away', 'soon as possible', 'water damage'];
  const urgentHit = urgentHints.some((u) => h.includes(u));

  if (emergencyRationale.length > 0) {
    return { tier: 'emergency', rationale: emergencyRationale, hasPlumbingContent: true };
  }
  if (urgentHit && hasPlumbingContent) {
    return { tier: 'urgent', rationale: ['language:urgent_plus_plumbing'], hasPlumbingContent: true };
  }
  if (hasPlumbingContent) {
    return { tier: 'standard', rationale: [], hasPlumbingContent: true };
  }
  if (params.spamSignals.length > 0) {
    return { tier: 'spam', rationale: params.spamSignals.slice(0, 5).map((s) => `spam:${s}`), hasPlumbingContent: false };
  }
  return { tier: 'standard', rationale: [], hasPlumbingContent: false };
}

export function classifyCallerBehavior(params: {
  transcript: string;
  spamSignals: string[];
  emergencyTier: EmergencyTier;
  hasPlumbingContent: boolean;
  markSpamCalled: boolean;
  flagEmergencyCalled: boolean;
}): { behavior: CallerBehavior; rationale: string } {
  const h = params.transcript.toLowerCase();
  const abusivePatterns = /\b(f+u+c+k|shit|ass+holes?|bitch|dick|pussy|damn you|screw you|idiot)\b/i;
  const hasAbuse = abusivePatterns.test(h);
  const sexualPatterns = /\b(sex|nude|naked|dating|hookup|only\s*fans)\b/i;
  const hasSexual = sexualPatterns.test(h);
  const hasOffTopic = hasAbuse || hasSexual;
  const hasEmergency = params.emergencyTier === 'emergency' || params.flagEmergencyCalled;

  if (hasEmergency) {
    if (hasOffTopic) {
      return { behavior: 'emergency_legitimate', rationale: 'Emergency with abusive language; emergency takes priority' };
    }
    return { behavior: 'emergency_legitimate', rationale: 'Legitimate plumbing emergency detected' };
  }
  if (params.hasPlumbingContent) {
    if (hasOffTopic) {
      return { behavior: 'abusive_but_legitimate', rationale: 'Abusive language occurred, but a legitimate plumbing issue was identified' };
    }
    return { behavior: 'legitimate_plumbing', rationale: 'Legitimate plumbing inquiry' };
  }
  if (hasOffTopic && !params.hasPlumbingContent && params.spamSignals.length === 0) {
    return { behavior: 'off_topic_warning', rationale: 'Off-topic or abusive language without plumbing content yet' };
  }
  if (params.spamSignals.length > 0 && !params.hasPlumbingContent) {
    return { behavior: 'spam_or_prank', rationale: 'Non-plumbing content with spam signals' };
  }
  return { behavior: 'neutral', rationale: 'Insufficient signal to classify' };
}

export function inferIssueFromTranscript(transcript: string): string | null {
  const lines = transcript.split('\n');
  for (const line of lines) {
    const callerText = line.replace(/^(caller|user|customer)\s*:\s*/i, '');
    if (callerText === line) continue;
    const low = callerText.toLowerCase();
    const m = low.match(
      /\b(overflow\w*|flood\w*|leak\w*|burst\w*|clog\w*|backup\w*|sewage|no\s+(?:hot\s+)?water|water\s+heater|toilet|sink|faucet|drain|pipe|sewer|sump|valve|garbage\s+disposal)\b/i,
    );
    if (m) {
      const start = callerText.toLowerCase().indexOf(m[0]);
      const snippet = callerText.slice(Math.max(0, start - 30), start + m[0].length + 60).trim();
      if (snippet.length > 8) return snippet;
      return callerText.trim().slice(0, 120) || null;
    }
  }
  const full = transcript.toLowerCase();
  const gm = full.match(
    /(overflow\w*|flood\w*|leak\w*|burst pipe|clog\w*|backup|sewage|no\s+(?:hot\s+)?water|water heater)[^.!?\n]{0,80}/i,
  );
  if (gm) return gm[0].trim().slice(0, 120);
  return null;
}

export function inferCallerNameFromTranscript(transcript: string): string | null {
  const nameRe = /(?:my name(?:'s| is)\s+|(?:this is|i'm|i am)\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/m;
  const m = nameRe.exec(transcript);
  if (m?.[1]) {
    const name = m[1].trim();
    if (name.length > 1 && name.length < 60) return name;
  }
  return null;
}

export function buildFieldConfidence(params: {
  extracted: {
    phone?: string | null;
    callerName?: string | null;
    address?: string | null;
    issueDescription?: string | null;
    urgency?: string | null;
  };
  fromPhone: string | null;
  transcriptInferred: {
    phone?: boolean;
    callerName?: boolean;
    issueDescription?: boolean;
  };
}): Partial<Record<string, FieldConfidenceEntry>> {
  const out: Partial<Record<string, FieldConfidenceEntry>> = {};

  const phoneVal = params.extracted.phone;
  if (phoneVal && looksLikePhone(phoneVal)) {
    if (params.transcriptInferred.phone) {
      out.callback_phone = fc('inferred', 'transcript_inference');
    } else if (phoneVal === params.fromPhone) {
      out.callback_phone = fc('inferred', 'caller_ani');
    } else {
      out.callback_phone = fc('confirmed', 'explicit_tool_arg');
    }
  } else if (params.fromPhone && looksLikePhone(params.fromPhone)) {
    out.callback_phone = fc('inferred', 'caller_ani');
  } else {
    out.callback_phone = fc('missing', 'unknown');
  }

  if (params.extracted.callerName?.trim()) {
    out.caller_name = params.transcriptInferred.callerName
      ? fc('inferred', 'transcript_inference')
      : fc('confirmed', 'explicit_tool_arg');
  } else {
    out.caller_name = fc('missing', 'unknown');
  }

  if (params.extracted.address?.trim()) {
    out.service_address = looksLikeServiceAddress(params.extracted.address)
      ? fc('confirmed', 'explicit_tool_arg')
      : fc('weak', 'explicit_tool_arg');
  } else {
    out.service_address = fc('missing', 'unknown');
  }

  if (params.extracted.issueDescription?.trim()) {
    out.issue_summary = params.transcriptInferred.issueDescription
      ? fc('inferred', 'transcript_inference')
      : fc('confirmed', 'explicit_tool_arg');
  } else {
    out.issue_summary = fc('missing', 'unknown');
  }

  if (params.extracted.urgency) {
    out.urgency = fc('confirmed', 'explicit_tool_arg');
  }

  return out;
}

function fc(confidence: FieldConfidence, provenance: FieldProvenance): FieldConfidenceEntry {
  return { confidence, provenance };
}

export function countCallerTurns(transcript: string): number {
  if (!transcript.trim()) return 0;
  const lines = transcript.split(/\n/).filter((l) => /^caller\s*:/i.test(l.trim()));
  return lines.length;
}

export function detectAbandonedSignals(params: {
  transcript: string;
  durationSeconds: number;
  silenceMaxChars?: number;
}): string[] {
  const out: string[] = [];
  const t = params.transcript.trim();
  if (params.durationSeconds > 0 && params.durationSeconds < 25 && t.length < 40) {
    out.push('very_short_call');
  }
  if (params.silenceMaxChars !== undefined && t.length <= params.silenceMaxChars) {
    out.push('minimal_transcript');
  }
  if (countCallerTurns(params.transcript) === 0 && t.length > 80) {
    out.push('no_caller_turns_in_script');
  }
  return out;
}

export function logReceptionistHardening(message: string, data: Record<string, unknown>) {
  const safe = { ...data };
  for (const k of Object.keys(safe)) {
    const v = safe[k];
    if (typeof v === 'string' && (k.includes('phone') || k.includes('secret'))) {
      safe[k] = v.length > 4 ? `${v.slice(0, 2)}…${v.slice(-2)}` : '[redacted]';
    }
  }
  console.info(`[receptionist-hardening] ${message}`, safe);
}
