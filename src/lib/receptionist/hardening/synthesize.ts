import { isLikelyAfterHours } from '@/lib/receptionist/hardening/after-hours';
import { evaluateReceptionistCallCompleteness, deriveOperationalPriority } from '@/lib/receptionist/hardening/completeness';
import {
  buildFieldConfidence,
  classifyCallerBehavior,
  classifyEmergencyTier,
  collectSpamSignals,
  detectAbandonedSignals,
  detectSuspiciousIssueDescription,
  inferCallerNameFromTranscript,
  inferIssueFromTranscript,
  looksLikePhone,
  parseBookingRulesExtended,
  tryNormalizeIssuePhrase,
} from '@/lib/receptionist/hardening/heuristics';
import { mergeReceptionistMeta } from '@/lib/receptionist/hardening/merge-meta';
import { buildTimingHintsFromExtracted } from '@/lib/receptionist/hardening/timing';
import type { ReceptionistCallMeta } from '@/lib/receptionist/hardening/types';
import { parseEmergencyKeywordsJson } from '@/lib/receptionist/extract';
import type { ExtractedCallData, ReceptionistDisposition } from '@/lib/receptionist/types';
import type { ReceptionistSettingsRow } from '@/lib/receptionist/types';

export interface SynthesizeInput {
  callRow: Record<string, unknown>;
  extracted: ExtractedCallData;
  disposition: ReceptionistDisposition;
  bookings: { booking_type: string; status: string }[];
  toolInvocations: { tool_name: string; status: string }[];
  events: { event_type: string }[];
  settings: ReceptionistSettingsRow;
  durationSeconds: number;
}

export interface SynthesizeResult {
  mergedMetaJson: string;
  adjustedDisposition: ReceptionistDisposition;
  adjustedExtracted: ExtractedCallData;
  completenessDowngraded: boolean;
}

export function synthesizeReceptionistCallMeta(input: SynthesizeInput): SynthesizeResult {
  const rules = parseBookingRulesExtended(input.settings.booking_rules_json);
  const tz = rules.timezone || 'America/Toronto';
  const transcript = (input.callRow.transcript_text as string) || '';
  const spamSignals = collectSpamSignals(transcript, rules.spamKeywords);
  const emergencyKeywords = parseEmergencyKeywordsJson(input.settings.emergency_keywords_json);
  const triage = classifyEmergencyTier({ transcript, emergencyKeywords, spamSignals });

  const hasEmergencyEvent = input.events.some(
    (e) => e.event_type === 'emergency_flagged' || e.event_type.includes('emergency'),
  );
  const markSpamCalled = input.events.some((e) => e.event_type === 'spam_flagged' || e.event_type === 'mark_spam');
  const flagEmergencyCalled = hasEmergencyEvent;

  const behavior = classifyCallerBehavior({
    transcript,
    spamSignals,
    emergencyTier: triage.tier,
    hasPlumbingContent: triage.hasPlumbingContent,
    markSpamCalled,
    flagEmergencyCalled,
  });

  const adjustedExtracted = backfillExtracted(input.extracted, input.callRow, transcript);

  const issueRaw = adjustedExtracted.issueDescription || adjustedExtracted.issueType || '';
  const suspicious = detectSuspiciousIssueDescription(issueRaw);
  const norm = tryNormalizeIssuePhrase(issueRaw);

  const after = isLikelyAfterHours(input.settings.business_hours_json, tz);
  const timingHints = buildTimingHintsFromExtracted(
    adjustedExtracted.preferredCallbackWindow,
    adjustedExtracted.preferredVisitWindow,
    tz,
  );

  const isMockFlow = input.callRow.provider === 'mock' || Boolean(input.callRow.mock_scenario_id);

  const completeness = evaluateReceptionistCallCompleteness({
    callRow: input.callRow,
    extracted: adjustedExtracted,
    disposition: input.disposition,
    bookings: input.bookings,
    toolInvocations: input.toolInvocations,
    hasEmergencyEvent,
    isMockFlow,
  });

  const isEmergency =
    triage.tier === 'emergency' ||
    adjustedExtracted.emergencyDetected ||
    adjustedExtracted.urgency === 'emergency' ||
    hasEmergencyEvent ||
    input.disposition === 'emergency';

  let adjustedDisposition = input.disposition;
  let completenessDowngraded = false;

  if (isEmergency) {
    if (adjustedDisposition !== 'emergency') {
      adjustedDisposition = 'emergency';
      completenessDowngraded = adjustedDisposition !== input.disposition;
    }
  } else if (!completeness.sufficient && completeness.suggestedDisposition) {
    const suggested = completeness.suggestedDisposition;
    if (suggested === 'follow_up_needed' || suggested === 'spam') {
      if (behavior.behavior === 'abusive_but_legitimate' || behavior.behavior === 'legitimate_plumbing') {
        if (suggested === 'spam') {
          adjustedDisposition = 'follow_up_needed';
          completenessDowngraded = adjustedDisposition !== input.disposition;
        } else {
          adjustedDisposition = suggested;
          completenessDowngraded = adjustedDisposition !== input.disposition;
        }
      } else {
        adjustedDisposition = suggested;
        completenessDowngraded = adjustedDisposition !== input.disposition;
      }
    }
  }

  const fromPhone = (input.callRow.from_phone as string) || null;
  const phoneVal = adjustedExtracted.phone || fromPhone;
  const operationalPriority = deriveOperationalPriority({
    disposition: adjustedDisposition,
    emergencyTier: triage.tier,
    hasEmergencyEvent,
    hasCallbackPhone: looksLikePhone(phoneVal),
    emergencyDetected: adjustedExtracted.emergencyDetected,
  });

  const transcriptInferred = {
    phone: !input.extracted.phone && !!adjustedExtracted.phone && adjustedExtracted.phone !== fromPhone,
    callerName: !input.extracted.callerName && !!adjustedExtracted.callerName,
    issueDescription: !input.extracted.issueDescription && !!adjustedExtracted.issueDescription,
  };

  const fieldConfidence = buildFieldConfidence({
    extracted: adjustedExtracted,
    fromPhone,
    transcriptInferred,
  });

  const abandoned = detectAbandonedSignals({
    transcript,
    durationSeconds: input.durationSeconds,
    silenceMaxChars: rules.silenceTranscriptMaxChars ?? 12,
  });

  const patch: Partial<ReceptionistCallMeta> = {
    completeness,
    emergencyTier: triage.tier,
    emergencyRationale: triage.rationale,
    callerBehavior: behavior.behavior,
    behaviorRationale: behavior.rationale,
    operationalPriority,
    fieldConfidence,
    spamRationale: spamSignals.length ? spamSignals : undefined,
    issueRaw: issueRaw || null,
    issueNormalized: norm.normalized,
    issueSuspicious: suspicious.suspicious,
    issueNormalizationSource: norm.source === 'vocabulary_match' ? 'vocabulary_match' : 'none',
    timingHints,
    afterHours: { active: after.afterHours, mode: input.settings.after_hours_mode, note: after.note },
    incompleteReasons: completeness.missingLabels,
    abandonedSignals: abandoned.length ? abandoned : undefined,
  };

  const mergedMetaJson = mergeReceptionistMeta(input.callRow.receptionist_meta_json as string | undefined, patch);

  return { mergedMetaJson, adjustedDisposition, adjustedExtracted, completenessDowngraded };
}

function backfillExtracted(
  original: ExtractedCallData,
  callRow: Record<string, unknown>,
  transcript: string,
): ExtractedCallData {
  const ex = { ...original };
  const fromPhone = (callRow.from_phone as string) || null;
  const aiSummary = (callRow.ai_summary as string) || '';

  if (!ex.phone && fromPhone && looksLikePhone(fromPhone)) {
    ex.phone = fromPhone;
  }

  if (!ex.callerName?.trim()) {
    const rowName = (callRow.caller_name as string) || null;
    if (rowName?.trim()) {
      ex.callerName = rowName;
    } else {
      const inferred = inferCallerNameFromTranscript(transcript);
      if (inferred) ex.callerName = inferred;
    }
  }

  if (!ex.issueDescription?.trim()) {
    const inferred = inferIssueFromTranscript(transcript);
    if (inferred) {
      ex.issueDescription = inferred;
    } else if (aiSummary) {
      const fromSummary = inferIssueFromTranscript(aiSummary);
      if (fromSummary) ex.issueDescription = fromSummary;
    }
  }

  if (!ex.summary?.trim() && aiSummary) {
    ex.summary = aiSummary;
  }

  return ex;
}
