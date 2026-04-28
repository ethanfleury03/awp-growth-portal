/**
 * Post-call case synthesis: single structured artifact for staff from transcript + tools + meta.
 */
import type {
  ReceptionistCallMeta,
  FieldConfidenceEntry,
  ReceptionistCaseRecordStored,
} from '@/lib/receptionist/hardening/types';
import type { ReceptionistDisposition } from '@/lib/receptionist/types';
import type { ExtractedCallData } from '@/lib/receptionist/types';
import type { CallerLinkageResult } from '@/lib/receptionist/caller-match';
import { looksLikePhone, looksLikeServiceAddress } from '@/lib/receptionist/hardening/heuristics';

function fcToMap(
  fieldConfidence: ReceptionistCallMeta['fieldConfidence'],
): Record<string, { confidence: string; source: string }> {
  const out: Record<string, { confidence: string; source: string }> = {};
  if (!fieldConfidence) return out;
  for (const [k, v] of Object.entries(fieldConfidence)) {
    const e = v as FieldConfidenceEntry;
    out[k] = { confidence: e.confidence, source: e.provenance };
  }
  return out;
}

export function buildReceptionistCaseRecord(input: {
  transcript: string;
  aiSummary: string;
  recommendedNextStep: string;
  fromPhone: string | null;
  extracted: ExtractedCallData;
  disposition: ReceptionistDisposition;
  meta: ReceptionistCallMeta;
  callerLinkage: CallerLinkageResult | null;
  toolSummary: { name: string; status: string }[];
  hasEmergencyEvent: boolean;
}): ReceptionistCaseRecordStored {
  const missing: string[] = [];
  const ambiguities: string[] = [];
  const rawNotes: string[] = [];

  const bestPhone =
    (looksLikePhone(input.extracted.phone || '') ? input.extracted.phone : null) ||
    (looksLikePhone(input.fromPhone || '') ? input.fromPhone : null);
  if (!bestPhone) missing.push('callback_phone');

  const bestAddr =
    looksLikeServiceAddress(input.extracted.address || '') ? input.extracted.address : null;
  const needsAddr =
    input.disposition === 'quote_visit_booked' ||
    Boolean(input.meta.completeness?.items?.some((i) => i.key === 'address' && !i.ok));
  if (needsAddr && !bestAddr) {
    missing.push('service_address');
  }

  if (!input.extracted.callerName?.trim()) missing.push('caller_name');

  const issueRaw = input.extracted.issueDescription || input.extracted.issueType || '';
  if (!issueRaw.trim()) missing.push('issue_description');

  if (input.meta.issueSuspicious) {
    ambiguities.push('issue_text_may_be_mistranscribed_or_unclear');
  }
  if (input.aiSummary && issueRaw && !input.aiSummary.toLowerCase().includes(issueRaw.slice(0, 12).toLowerCase())) {
    ambiguities.push('summary_and_stated_issue_may_diverge_review_transcript');
  }

  if (input.extracted.phone && input.fromPhone && input.extracted.phone !== input.fromPhone) {
    rawNotes.push('extracted phone differs from ANI — confirm callback number with caller');
  }

  const canonicalIssue =
    [input.meta.issueNormalized, input.extracted.issueType, input.extracted.issueDescription]
      .find((s) => s && String(s).trim()) || input.aiSummary.slice(0, 240) || 'Plumbing inquiry';

  let recommendedStaffAction = input.recommendedNextStep || 'Review transcript and follow up as needed.';
  if (input.meta.operationalPriority?.startsWith('emergency')) {
    recommendedStaffAction = 'Emergency path: human callback or dispatch review immediately — verify safety.';
  } else if (input.disposition === 'follow_up_needed') {
    recommendedStaffAction = 'Assign follow-up: booking incomplete or tools requested human handoff.';
  } else if (input.disposition === 'spam') {
    recommendedStaffAction = 'No action unless dispute — classified as spam/prank.';
  }

  if (input.callerLinkage?.outcome === 'exact_customer_match' || input.callerLinkage?.outcome === 'exact_lead_match') {
    recommendedStaffAction += ' Known customer/lead match — reconcile any new details with CRM record.';
  }

  const urgencyNote =
    input.extracted.urgency === 'emergency' || input.hasEmergencyEvent
      ? 'Emergency or urgent signals present'
      : input.extracted.urgency === 'high'
        ? 'High urgency (non-emergency)'
        : null;

  const emergencyShort =
    Array.isArray(input.meta.emergencyRationale) && input.meta.emergencyRationale.length
      ? input.meta.emergencyRationale.slice(0, 3).join('; ')
      : null;

  return {
    version: 1,
    canonicalIssueSummary: String(canonicalIssue).slice(0, 500),
    normalizedIssueType: input.meta.issueNormalized || input.extracted.issueType || null,
    bestCallbackPhone: bestPhone,
    bestServiceAddress: bestAddr,
    urgencyNote,
    emergencyRationaleShort: emergencyShort,
    recommendedStaffAction,
    missingCriticalFields: missing,
    unresolvedAmbiguities: ambiguities,
    fieldConfidenceMap: fcToMap(input.meta.fieldConfidence),
    rawVsInferredNotes: rawNotes,
    synthesizedAt: new Date().toISOString(),
  };
}
