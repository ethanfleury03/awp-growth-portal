import {
  classifyEmergencyTier,
  collectSpamSignals,
  detectSuspiciousIssueDescription,
  tryNormalizeIssuePhrase,
} from '@/lib/receptionist/hardening/heuristics';
import type { ExtractedCallData, MockScenarioDefinition, ReceptionistDisposition } from '@/lib/receptionist/types';

const DEFAULT_EMERGENCY_PHRASES = [
  'burst pipe',
  'pipe burst',
  'flooding',
  'flood',
  'sewer backup',
  'sewage',
  'no water',
  'gas smell',
  'water everywhere',
  'major leak',
  'gushing',
  'basement full of water',
];

function normalizeText(s: string) {
  return s.toLowerCase();
}

function containsAny(haystack: string, needles: string[]) {
  const h = normalizeText(haystack);
  return needles.some((n) => h.includes(normalizeText(n)));
}

export function parseEmergencyKeywordsJson(json: string | null | undefined): string[] {
  if (!json) return [...DEFAULT_EMERGENCY_PHRASES];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return [...DEFAULT_EMERGENCY_PHRASES, ...parsed];
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_EMERGENCY_PHRASES];
}

function extractPhonesFromText(text: string): string[] {
  const re = /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0].trim());
  }
  return out;
}

function defaultExtracted(): ExtractedCallData {
  return {
    callerName: null,
    phone: null,
    address: null,
    issueType: null,
    issueDescription: null,
    urgency: 'medium',
    preferredCallbackWindow: null,
    preferredVisitWindow: null,
    emergencyDetected: false,
    existingCustomerPossible: false,
    spamLikely: false,
    summary: '',
    nextStep: '',
  };
}

function mergeExtracted(
  base: ExtractedCallData,
  partial: Partial<ExtractedCallData>,
): ExtractedCallData {
  return {
    ...base,
    ...partial,
    summary: partial.summary ?? base.summary,
    nextStep: partial.nextStep ?? base.nextStep,
  };
}

/**
 * Deterministic extraction for mock mode and when no LLM is configured.
 * Replace `extractCallFieldsWithModel()` later without changing callers.
 */
export function extractCallFieldsFromTranscript(
  transcript: string,
  scenario: MockScenarioDefinition | null,
  emergencyKeywords: string[],
): ExtractedCallData {
  let data = defaultExtracted();

  if (scenario?.extractedBaseline) {
    data = mergeExtracted(data, scenario.extractedBaseline as Partial<ExtractedCallData>);
  }

  const callerLines = transcript
    .split('\n')
    .filter((line) => line.startsWith('Caller:'))
    .map((line) => line.replace(/^Caller:\s*/i, ''))
    .join(' ');

  const phones = extractPhonesFromText(callerLines || transcript);
  if (phones.length > 0 && !data.phone) {
    data.phone = phones[0];
  }

  const spamSignalsLegacy = [
    'car warranty',
    'limited time',
    'press 1',
    'automated offer',
    'not interested in plumbing',
  ];
  if (containsAny(transcript, spamSignalsLegacy)) {
    data.spamLikely = true;
  }

  const triageText = `${transcript}\n${callerLines}`;
  const spamHits = collectSpamSignals(triageText, undefined);
  const triage = classifyEmergencyTier({
    transcript: triageText,
    emergencyKeywords,
    spamSignals: data.spamLikely ? [...spamHits, 'legacy_spam_signal'] : spamHits,
  });
  if (triage.tier === 'emergency') {
    data.emergencyDetected = true;
    data.urgency = 'emergency';
    data.spamLikely = false;
  } else if (triage.tier === 'urgent') {
    data.urgency = data.urgency === 'emergency' ? 'emergency' : 'high';
    if (triage.hasPlumbingContent) data.spamLikely = false;
  } else if (triage.tier === 'spam' && !triage.hasPlumbingContent) {
    data.spamLikely = true;
  } else if (triage.hasPlumbingContent) {
    data.spamLikely = false;
  }

  const issueProbe = detectSuspiciousIssueDescription(
    data.issueDescription || data.issueType || undefined,
  );
  const norm = tryNormalizeIssuePhrase(data.issueDescription || data.issueType || undefined);
  if (issueProbe.suspicious && norm.normalized) {
    data.issueDescription = norm.normalized;
    data.issueType = norm.normalized;
  }

  if (data.spamLikely) {
    data.summary = 'Caller appeared to be spam or unrelated to plumbing service.';
    data.nextStep = 'Mark as spam and block repeat dialers if needed.';
    return data;
  }

  if (data.emergencyDetected) {
    data.summary =
      data.issueDescription ||
      'Urgent plumbing situation reported; caller may need immediate dispatch.';
    data.nextStep = 'Escalate to on-call technician and confirm callback within minutes.';
    return data;
  }

  const short =
    transcript.length > 400 ? `${transcript.slice(0, 397)}...` : transcript;
  data.summary =
    scenario?.description ||
    `Inbound plumbing inquiry. Transcript excerpt: ${short.replace(/\n/g, ' ')}`;

  if (!data.nextStep) {
    if (data.preferredVisitWindow || scenario?.expectedOutcome === 'quote_visit_booked') {
      data.nextStep = 'Confirm an on-site estimate window with dispatch (no pricing promised until visit).';
    } else if (data.preferredCallbackWindow || scenario?.expectedOutcome === 'callback_booked') {
      data.nextStep = 'Schedule a callback in the requested window.';
    } else {
      data.nextStep = 'Review details and follow up with the customer.';
    }
  }

  return data;
}

export function decideDisposition(
  extracted: ExtractedCallData,
  scenario: MockScenarioDefinition | null,
): ReceptionistDisposition {
  if (extracted.emergencyDetected) return 'emergency';
  if (extracted.spamLikely) return 'spam';
  if (scenario?.expectedOutcome) return scenario.expectedOutcome;
  if (extracted.preferredVisitWindow) return 'quote_visit_booked';
  if (extracted.preferredCallbackWindow) return 'callback_booked';
  return 'follow_up_needed';
}

export function dispositionToRecommendedStep(
  disposition: ReceptionistDisposition,
  extracted: ExtractedCallData,
): string {
  switch (disposition) {
    case 'spam':
      return 'Dismiss and optionally log for compliance.';
    case 'emergency':
      return 'Dispatch on-call plumber; do not quote arrival time until confirmed.';
    case 'callback_booked':
      return extracted.nextStep || 'Complete callback booking in the CRM.';
    case 'quote_visit_booked':
      return extracted.nextStep || 'Confirm estimate visit on the calendar.';
    case 'lead_created':
      return 'Assign lead owner and prioritize by urgency.';
    case 'follow_up_needed':
    default:
      return extracted.nextStep || 'Human review: qualify and propose next actions.';
  }
}
