import {
  detectSuspiciousIssueDescription,
  looksLikePhone,
  looksLikeServiceAddress,
} from '@/lib/receptionist/hardening/heuristics';
import type { CallCompletenessResult, OperationalPriority } from '@/lib/receptionist/hardening/types';
import type { ExtractedCallData, ReceptionistDisposition } from '@/lib/receptionist/types';

export interface CompletenessContext {
  callRow: Record<string, unknown>;
  extracted: ExtractedCallData;
  disposition: ReceptionistDisposition;
  bookings: { booking_type: string; status: string }[];
  toolInvocations: { tool_name: string; status: string }[];
  hasEmergencyEvent: boolean;
  isMockFlow: boolean;
}

function toolSucceeded(tools: { tool_name: string; status: string }[], name: string) {
  return tools.some((t) => t.tool_name === name && t.status === 'ok');
}

function hasScheduledBooking(
  bookings: { booking_type: string; status: string }[],
  type: 'callback' | 'quote_visit',
) {
  return bookings.some((b) => b.booking_type === type && (b.status === 'scheduled' || b.status === 'requested'));
}

/**
 * Deterministic safety checklist for receptionist outcomes.
 * IMPORTANT: emergency urgency is never erased by missing data —
 * instead the disposition is preserved at 'emergency' and
 * operationalPriority captures the nuance.
 */
export function evaluateReceptionistCallCompleteness(ctx: CompletenessContext): CallCompletenessResult {
  const items: CallCompletenessResult['items'] = [];
  const ex = ctx.extracted;
  const fromPhone = (ctx.callRow.from_phone as string) || null;
  const phone = ex.phone || fromPhone;
  const isEmergency = ex.emergencyDetected || ex.urgency === 'emergency' || ctx.disposition === 'emergency' || ctx.hasEmergencyEvent;

  const nameOk = Boolean(ex.callerName?.trim() || ctx.callRow.caller_name);
  items.push({
    key: 'caller_name',
    ok: nameOk,
    detail: nameOk ? undefined : 'Missing caller name',
  });

  const phoneOk = looksLikePhone(phone);
  items.push({
    key: 'callback_number',
    ok: phoneOk,
    detail: phoneOk ? undefined : 'No plausible callback number',
  });

  const issueText = ex.issueDescription || ex.issueType || '';
  const issueProbe = detectSuspiciousIssueDescription(issueText);
  const issueOk =
    Boolean(issueText?.trim()) && (!issueProbe.suspicious || ctx.isMockFlow || isEmergency);
  items.push({
    key: 'issue_description',
    ok: issueOk,
    detail:
      issueProbe.suspicious && !ctx.isMockFlow && !isEmergency
        ? `Suspicious issue: ${issueProbe.reasons.join(',')}`
        : undefined,
  });

  items.push({
    key: 'urgency_classified',
    ok: Boolean(ex.urgency),
    detail: undefined,
  });

  const visitAttempt =
    Boolean(ex.preferredVisitWindow?.trim()) || ctx.disposition === 'quote_visit_booked';
  const addressOk = looksLikeServiceAddress(ex.address);
  items.push({
    key: 'service_address_for_visit',
    ok: !visitAttempt || addressOk || ctx.isMockFlow,
    detail:
      visitAttempt && !addressOk && !ctx.isMockFlow
        ? 'On-site visit intent without plausible address'
        : undefined,
  });

  const bookingAttempt =
    Boolean(ex.preferredCallbackWindow?.trim()) ||
    Boolean(ex.preferredVisitWindow?.trim()) ||
    ctx.disposition === 'callback_booked' ||
    ctx.disposition === 'quote_visit_booked';

  const timingOk =
    !bookingAttempt ||
    Boolean(ex.preferredCallbackWindow?.trim() || ex.preferredVisitWindow?.trim());
  items.push({
    key: 'booking_timing_captured',
    ok: timingOk,
    detail: !timingOk ? 'Booking-style outcome without timing text' : undefined,
  });

  let toolBookingOk = true;
  if (!ctx.isMockFlow && (ctx.disposition === 'callback_booked' || ctx.disposition === 'quote_visit_booked')) {
    const cb = ctx.disposition === 'callback_booked';
    const hasBooking = hasScheduledBooking(ctx.bookings, cb ? 'callback' : 'quote_visit');
    const toolName = cb ? 'book_callback' : 'book_quote_visit';
    const toolOk = toolSucceeded(ctx.toolInvocations, toolName);
    toolBookingOk = hasBooking || toolOk;
    items.push({
      key: 'tool_booking_confirmed',
      ok: toolBookingOk,
      detail: toolBookingOk ? undefined : 'Booked disposition without scheduled booking or successful tool',
    });
  } else {
    items.push({ key: 'tool_booking_confirmed', ok: true, detail: 'N/A (mock or non-booked disposition)' });
  }

  items.push({
    key: 'disposition_set',
    ok: Boolean(ctx.disposition),
    detail: undefined,
  });

  const summaryOk = Boolean(ex.summary?.trim() || ctx.callRow.ai_summary);
  items.push({
    key: 'summary_or_notes',
    ok: summaryOk,
    detail: summaryOk ? undefined : 'No summary available',
  });

  const spamOk = !ex.spamLikely || ctx.disposition === 'spam' || isEmergency;
  items.push({
    key: 'spam_classification_consistent',
    ok: spamOk,
    detail: spamOk ? undefined : 'Spam signals but disposition not spam',
  });

  let emergencyOk = true;
  if (isEmergency) {
    emergencyOk = ctx.disposition === 'emergency' || ctx.hasEmergencyEvent;
    items.push({
      key: 'emergency_escalation_complete',
      ok: emergencyOk,
      detail: emergencyOk ? undefined : 'Emergency detected but not flagged in system',
    });
  } else {
    items.push({ key: 'emergency_escalation_complete', ok: true, detail: 'N/A' });
  }

  const missingLabels = items.filter((i) => !i.ok).map((i) => i.detail || i.key);
  const sufficient = missingLabels.length === 0;

  let suggestedDisposition: ReceptionistDisposition | undefined;
  let downgradeReason: string | undefined;

  if (!sufficient) {
    if (isEmergency) {
      suggestedDisposition = 'emergency';
      downgradeReason = 'emergency_incomplete_data';
    } else if (ex.spamLikely && ctx.disposition !== 'spam') {
      suggestedDisposition = 'spam';
      downgradeReason = 'spam_signals';
    } else if (
      (ctx.disposition === 'callback_booked' || ctx.disposition === 'quote_visit_booked') &&
      !toolBookingOk
    ) {
      suggestedDisposition = 'follow_up_needed';
      downgradeReason = 'booking_not_confirmed_by_tool_or_row';
    } else if (visitAttempt && !addressOk) {
      suggestedDisposition = 'follow_up_needed';
      downgradeReason = 'quote_visit_missing_address';
    } else if (issueProbe.suspicious && !ctx.isMockFlow) {
      suggestedDisposition = 'follow_up_needed';
      downgradeReason = 'issue_needs_clarification';
    } else {
      suggestedDisposition = 'follow_up_needed';
      downgradeReason = 'incomplete_data';
    }
  }

  return {
    items,
    sufficient,
    missingLabels,
    suggestedDisposition,
    downgradeReason,
  };
}

export function deriveOperationalPriority(params: {
  disposition: ReceptionistDisposition;
  emergencyTier: string;
  hasEmergencyEvent: boolean;
  hasCallbackPhone: boolean;
  emergencyDetected: boolean;
}): OperationalPriority {
  const isEmergency =
    params.emergencyTier === 'emergency' ||
    params.disposition === 'emergency' ||
    params.hasEmergencyEvent ||
    params.emergencyDetected;

  if (isEmergency) {
    if (params.hasCallbackPhone) return 'emergency_callback_required';
    return 'emergency_incomplete_but_urgent';
  }
  if (params.emergencyTier === 'urgent') return 'urgent_follow_up';
  if (params.disposition === 'spam') return 'spam_no_action';
  if (params.disposition === 'follow_up_needed') return 'standard';
  return 'standard';
}
