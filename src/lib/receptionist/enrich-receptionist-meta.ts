import { matchCallerToExistingEntities, type CallerLinkageResult } from '@/lib/receptionist/caller-match';
import { buildReceptionistCaseRecord } from '@/lib/receptionist/case-synthesize';
import { parseReceptionistMeta, mergeReceptionistMeta } from '@/lib/receptionist/hardening/merge-meta';
import type { ReceptionistCallMeta } from '@/lib/receptionist/hardening/types';
import type { ReceptionistDisposition } from '@/lib/receptionist/types';
import type { ExtractedCallData } from '@/lib/receptionist/types';

export interface EnrichMetaInput {
  companyId: string;
  callId: string;
  callRow: Record<string, unknown>;
  extracted: ExtractedCallData;
  disposition: ReceptionistDisposition;
  mergedMetaJson: string;
  toolInvocations: { tool_name: string; status: string }[];
  events: { event_type: string }[];
}

/**
 * After synthesizeReceptionistCallMeta, attach caller linkage + structured case record for UI/staff.
 */
export async function enrichReceptionistMetaAfterSynthesis(input: EnrichMetaInput): Promise<string> {
  const baseMeta = parseReceptionistMeta(input.mergedMetaJson);
  const transcript = (input.callRow.transcript_text as string) || '';
  const aiSummary = (input.callRow.ai_summary as string) || input.extracted.summary || '';
  const recommended = (input.callRow.recommended_next_step as string) || '';
  const fromPhone = (input.callRow.from_phone as string) || null;

  let callerLinkage: CallerLinkageResult | null = null;
  try {
    callerLinkage = await matchCallerToExistingEntities({
      companyId: input.companyId,
      excludeCallId: input.callId,
      fromPhone,
      extracted: input.extracted,
    });
  } catch {
    callerLinkage = { outcome: 'no_match', rationale: ['linkage_error_skipped'] };
  }

  const hasEmergencyEvent = input.events.some(
    (e) => e.event_type === 'emergency_flagged' || e.event_type.includes('emergency'),
  );

  const caseRecord = buildReceptionistCaseRecord({
    transcript,
    aiSummary,
    recommendedNextStep: recommended,
    fromPhone,
    extracted: input.extracted,
    disposition: input.disposition,
    meta: baseMeta,
    callerLinkage,
    toolSummary: input.toolInvocations.map((t) => ({ name: t.tool_name, status: t.status })),
    hasEmergencyEvent,
  });

  const hints = deriveStaffWorkflowHints(baseMeta, input.disposition, caseRecord);
  const staffWorkflow: ReceptionistCallMeta['staffWorkflow'] = {
    ...baseMeta.staffWorkflow,
    ...hints,
  };

  const linkageStored: ReceptionistCallMeta['callerLinkage'] = callerLinkage
    ? {
        outcome: callerLinkage.outcome,
        customerId: callerLinkage.customerId,
        leadId: callerLinkage.leadId,
        priorCallId: callerLinkage.priorCallId,
        rationale: callerLinkage.rationale,
      }
    : undefined;

  const patch: Partial<ReceptionistCallMeta> = {
    callerLinkage: linkageStored,
    caseRecord,
    staffWorkflow,
  };

  return mergeReceptionistMeta(input.mergedMetaJson, patch);
}

function deriveStaffWorkflowHints(
  meta: ReceptionistCallMeta,
  disposition: ReceptionistDisposition,
  caseRecord: { missingCriticalFields: string[]; recommendedStaffAction: string },
): ReceptionistCallMeta['staffWorkflow'] {
  let waitingOn: 'office' | 'on_call' | 'customer' | 'schedule' | null = null;
  if (meta.operationalPriority?.startsWith('emergency')) {
    waitingOn = 'on_call';
  } else if (meta.afterHours?.active) {
    waitingOn = 'office';
  } else if (disposition === 'callback_booked' || disposition === 'quote_visit_booked') {
    waitingOn = 'schedule';
  } else if (caseRecord.missingCriticalFields.length) {
    waitingOn = 'customer';
  } else {
    waitingOn = 'office';
  }
  return {
    waitingOn,
    recommendedHumanAction: caseRecord.recommendedStaffAction,
  };
}
