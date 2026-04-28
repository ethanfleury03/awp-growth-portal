import { sql } from '@/lib/db';
import {
  detectSuspiciousIssueDescription,
  logReceptionistHardening,
  looksLikePhone,
  looksLikeServiceAddress,
  parseBookingRulesExtended,
} from '@/lib/receptionist/hardening/heuristics';
import { parseReceptionistMeta } from '@/lib/receptionist/hardening/merge-meta';
import type {
  DuplicateResolutionInfo,
  InternalBookingOutcome,
  ReceptionistCallMeta,
} from '@/lib/receptionist/hardening/types';
import {
  createCustomerAndLeadFromExtracted,
  createJobForBooking,
  getCompanyIdForReceptionist,
  suggestScheduleForBooking,
} from '@/lib/receptionist/integrations';
import {
  finalizeReceptionistCall,
  findActiveBookingOnCall,
  getReceptionistCallDetail,
  linkJobToCall,
  linkLeadToCall,
  listMockScenariosFromDb,
  listReceptionistCalls,
  logReceptionistEvent,
  mergeReceptionistMetaPartial,
  reprocessReceptionistCall,
  startMockCall,
  advanceMockCall,
  endMockCall,
  ensureReceptionistSettings,
  updateReceptionistSettings,
  getDashboardStats,
  updateCallDisposition,
} from '@/lib/receptionist/repository';
import type { ExtractedCallData, ReceptionistDisposition } from '@/lib/receptionist/types';
import {
  DEFAULT_CROSS_CALL_WINDOW_HOURS,
  EMERGENCY_CROSS_CALL_WINDOW_HOURS,
  getLastSuccessfulToolPayload,
  listCrossCallBookingCandidates,
  listCrossCallLeadCandidates,
  normalizePhoneDigits,
  rankBookingDuplicate,
  rankLeadDuplicate,
} from '@/lib/receptionist/duplicate-resolve';
import {
  applyStaffHandoffAction,
  ensureEmergencyHumanFollowUpTask,
  type StaffHandoffAction,
} from '@/lib/receptionist/staff-handoff';

function parseExtracted(call: Record<string, unknown>): ExtractedCallData | null {
  const raw = call.extracted_json as string | null | undefined;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExtractedCallData;
  } catch {
    return null;
  }
}

/** When extracted_json is empty but the call row has PSTN / transcript context (common for live Retell mid-call). */
function buildExtractedFallbackFromCallRow(call: Record<string, unknown>): ExtractedCallData {
  return {
    callerName: (call.caller_name as string) || null,
    phone: (call.from_phone as string) || null,
    address: null,
    issueType: 'Phone inquiry',
    issueDescription: (call.transcript_text as string) || (call.ai_summary as string) || null,
    urgency: 'medium',
    preferredCallbackWindow: null,
    preferredVisitWindow: null,
    emergencyDetected: false,
    existingCustomerPossible: false,
    spamLikely: false,
    summary: (call.ai_summary as string) || '',
    nextStep: '',
  };
}

function callIsEmergency(extracted: ExtractedCallData, call: Record<string, unknown>): boolean {
  return (
    extracted.emergencyDetected ||
    extracted.urgency === 'emergency' ||
    call.disposition === 'emergency' ||
    call.urgency === 'emergency'
  );
}

function duplicateResolutionBase(
  recordType: 'callback' | 'quote_visit' | 'lead',
  rationale: string[],
): Pick<DuplicateResolutionInfo, 'outcome' | 'recordType' | 'rationale' | 'at'> {
  return {
    outcome: 'cross_call_merged',
    recordType,
    rationale,
    at: new Date().toISOString(),
  };
}

export const receptionistService = {
  getSettings: ensureReceptionistSettings,
  updateSettings: updateReceptionistSettings,
  startMockCall,
  advanceMockCall,
  endMockCall,
  finalizeCall: finalizeReceptionistCall,
  reprocessCall: reprocessReceptionistCall,
  listCalls: listReceptionistCalls,
  getCallDetail: getReceptionistCallDetail,
  dashboardStats: getDashboardStats,
  listScenarios: listMockScenariosFromDb,

  applyStaffHandoff(callId: string, action: StaffHandoffAction, opts?: { plumberId?: string | null; note?: string }) {
    return applyStaffHandoffAction(callId, action, opts);
  },

  async createLeadFromCall(callId: string) {
    const detail = await getReceptionistCallDetail(callId);
    if (!detail) throw new Error('Call not found');
    const call = detail.call as Record<string, unknown>;
    if (call.lead_id) {
      return { leadId: call.lead_id as string, alreadyLinked: true as const };
    }

    const prior = await getLastSuccessfulToolPayload(callId, 'create_lead');
    if (prior?.leadId) {
      const leadId = String(prior.leadId);
      await linkLeadToCall(callId, leadId);
      await sql`
        UPDATE receptionist_calls
        SET disposition = ${'lead_created' satisfies ReceptionistDisposition}, updated_at = datetime('now')
        WHERE id = ${callId}
      `;
      return { leadId, alreadyLinked: false as const, idempotentReplay: true as const };
    }

    let extracted = parseExtracted(call);
    if (!extracted && call.status !== 'completed') {
      await finalizeReceptionistCall(callId);
      const again = await getReceptionistCallDetail(callId);
      extracted = parseExtracted(again!.call as Record<string, unknown>);
    }
    if (!extracted) {
      extracted = {
        callerName: (call.caller_name as string) || null,
        phone: (call.from_phone as string) || null,
        address: null,
        issueType: 'Phone inquiry',
        issueDescription: (call.transcript_text as string) || null,
        urgency: 'medium',
        preferredCallbackWindow: null,
        preferredVisitWindow: null,
        emergencyDetected: false,
        existingCustomerPossible: false,
        spamLikely: false,
        summary: (call.ai_summary as string) || '',
        nextStep: '',
      };
    }

    const companyId = await getCompanyIdForReceptionist();
    const phoneNorm = normalizePhoneDigits(extracted.phone || (call.from_phone as string) || '');
    const isEm = callIsEmergency(extracted, call);
    const windowH = isEm ? EMERGENCY_CROSS_CALL_WINDOW_HOURS : DEFAULT_CROSS_CALL_WINDOW_HOURS;
    const leadCandidates = await listCrossCallLeadCandidates({
      companyId,
      excludeCallId: callId,
      windowHours: windowH,
    });

    let bestLead: { leadId: string; rank: ReturnType<typeof rankLeadDuplicate> } | null = null;
    for (const c of leadCandidates) {
      const rank = rankLeadDuplicate(extracted, phoneNorm, c);
      if (!bestLead || rank.score > bestLead.rank.score) {
        bestLead = { leadId: c.leadId, rank };
      }
    }

    const mergeLead =
      bestLead &&
      phoneNorm.length >= 10 &&
      (bestLead.rank.confidence === 'high' ||
        (bestLead.rank.confidence === 'medium' && isEm && bestLead.rank.score >= 50));

    if (mergeLead && bestLead) {
      const leadId = bestLead.leadId;
      await linkLeadToCall(callId, leadId);
      await mergeReceptionistMetaPartial(callId, {
        internalOutcome: 'booking_duplicate_merged',
        duplicateResolution: {
          ...duplicateResolutionBase('lead', bestLead.rank.rationale),
          priorLeadId: leadId,
        },
      });
      await logReceptionistEvent(
        callId,
        'duplicate_lead_cross_call_merged',
        { priorLeadId: leadId, confidence: bestLead.rank.confidence },
        'system',
      );
      logReceptionistHardening('duplicate_lead_cross_call_merged', { callId, leadId });
      await sql`
        UPDATE receptionist_calls
        SET disposition = ${'lead_created' satisfies ReceptionistDisposition}, updated_at = datetime('now')
        WHERE id = ${callId}
      `;
      const callRow = (await sql`SELECT call_log_id FROM receptionist_calls WHERE id = ${callId}`)[0] as Record<
        string,
        unknown
      >;
      if (callRow.call_log_id) {
        await sql`
          UPDATE call_logs SET lead_id = ${leadId}, updated_at = datetime('now')
          WHERE id = ${callRow.call_log_id}
        `;
      }
      return {
        leadId,
        alreadyLinked: false as const,
        crossCallMerged: true as const,
      };
    }

    if (bestLead && bestLead.rank.confidence === 'medium' && !mergeLead) {
      await mergeReceptionistMetaPartial(callId, {
        duplicateResolution: {
          outcome: 'potential_duplicate_noted',
          recordType: 'lead',
          priorLeadId: bestLead.leadId,
          confidence: 'medium',
          rationale: bestLead.rank.rationale,
          at: new Date().toISOString(),
        },
      });
    }

    const { lead } = await createCustomerAndLeadFromExtracted(companyId, extracted, 'ai_receptionist');
    const leadId = lead.id as string;
    await linkLeadToCall(callId, leadId);
    await mergeReceptionistMetaPartial(callId, {
      duplicateResolution: {
        outcome: 'new_record',
        recordType: 'lead',
        at: new Date().toISOString(),
      },
    });

    await sql`
      UPDATE receptionist_calls
      SET disposition = ${'lead_created' satisfies ReceptionistDisposition}, updated_at = datetime('now')
      WHERE id = ${callId}
    `;

    const callRow = (await sql`SELECT call_log_id FROM receptionist_calls WHERE id = ${callId}`)[0] as Record<
      string,
      unknown
    >;
    if (callRow.call_log_id) {
      await sql`
        UPDATE call_logs SET lead_id = ${leadId}, updated_at = datetime('now')
        WHERE id = ${callRow.call_log_id}
      `;
    }

    return { leadId, alreadyLinked: false as const };
  },

  async bookCallbackFromCall(
    callId: string,
    opts?: { skipIssueClarificationGuard?: boolean },
  ) {
    const settings = await ensureReceptionistSettings();
    if (!settings.callback_booking_enabled) {
      throw new Error('Callback booking is disabled in receptionist settings');
    }
    const detail = await getReceptionistCallDetail(callId);
    if (!detail) throw new Error('Call not found');
    const call = detail.call as Record<string, unknown>;
    let extracted = parseExtracted(call);
    if (!extracted) {
      extracted = buildExtractedFallbackFromCallRow(call);
    }

    const rules = parseBookingRulesExtended(settings.booking_rules_json);
    const existing = await findActiveBookingOnCall(callId, 'callback');
    if (existing) {
      await mergeReceptionistMetaPartial(callId, {
        internalOutcome: 'booking_duplicate_merged',
        duplicateNotes: [`same_call_booking:${existing.id}`],
        duplicateResolution: {
          outcome: 'same_call_reused',
          recordType: 'callback',
          priorBookingId: existing.id,
          priorJobId: existing.job_id || undefined,
          confidence: 'high',
          rationale: ['same_receptionist_call_active_booking'],
          at: new Date().toISOString(),
        },
      });
      logReceptionistHardening('duplicate_booking_same_call', {
        callId,
        bookingId: existing.id,
      });
      if (!existing.job_id) throw new Error('Existing callback booking is missing a linked job');
      return { bookingId: existing.id, jobId: existing.job_id, duplicate: true as const };
    }

    const priorTool = await getLastSuccessfulToolPayload(callId, 'book_callback');
    if (priorTool?.jobId) {
      return {
        bookingId: String(priorTool.bookingId || priorTool.booking_id || ''),
        jobId: String(priorTool.jobId),
        duplicate: true as const,
        idempotentReplay: true as const,
      };
    }

    const phone = extracted.phone || (call.from_phone as string) || '';
    if (!looksLikePhone(phone)) {
      logReceptionistHardening('booking_validation_failed', { callId, field: 'phone' });
      throw new Error('Callback booking requires a valid 10-digit phone number');
    }

    const issueText = extracted.issueDescription || extracted.issueType || '';
    const sus = detectSuspiciousIssueDescription(issueText);
    const meta = parseReceptionistMeta(call.receptionist_meta_json as string | undefined);
    if (sus.suspicious && !meta.confirmations?.issue_clarified && !opts?.skipIssueClarificationGuard) {
      logReceptionistHardening('booking_blocked_suspicious_issue', { callId, reasons: sus.reasons });
      throw new Error(
        'Issue description looks unclear or mis-transcribed; confirm the problem with the caller before booking.',
      );
    }

    const phoneNorm = normalizePhoneDigits(phone);
    const isEm = callIsEmergency(extracted, call);
    const windowH = Math.min(
      72,
      Math.max(2, Math.ceil((rules.duplicateWindowMinutes ?? 120) / 60)),
    );
    const candidates = await listCrossCallBookingCandidates({
      excludeCallId: callId,
      bookingType: 'callback',
      windowHours: isEm ? EMERGENCY_CROSS_CALL_WINDOW_HOURS : windowH,
    });

    let bestCb: {
      bookingId: string;
      callId: string;
      jobId: string | null;
      rank: ReturnType<typeof rankBookingDuplicate>;
    } | null = null;
    for (const c of candidates) {
      const rank = rankBookingDuplicate(extracted, phoneNorm, c);
      if (!bestCb || rank.score > bestCb.rank.score) {
        bestCb = { bookingId: c.bookingId, callId: c.callId, jobId: c.jobId, rank };
      }
    }

    const shouldMergeCb =
      bestCb &&
      bestCb.jobId &&
      phoneNorm.length >= 10 &&
      (bestCb.rank.confidence === 'high' ||
        (bestCb.rank.confidence === 'medium' && isEm) ||
        (isEm && bestCb.rank.score >= 55));

    if (shouldMergeCb && bestCb && bestCb.jobId) {
      await linkJobToCall(callId, bestCb.jobId);
      await sql`
        UPDATE receptionist_calls
        SET disposition = ${'callback_booked' satisfies ReceptionistDisposition},
            job_id = ${bestCb.jobId},
            updated_at = datetime('now')
        WHERE id = ${callId}
      `;
      await mergeReceptionistMetaPartial(callId, {
        internalOutcome: 'booking_duplicate_merged',
        duplicateResolution: {
          ...duplicateResolutionBase('callback', bestCb.rank.rationale),
          priorCallId: bestCb.callId,
          priorBookingId: bestCb.bookingId,
          priorJobId: bestCb.jobId,
          confidence: bestCb.rank.confidence,
        },
      });
      await logReceptionistEvent(
        callId,
        'duplicate_booking_cross_call_merged',
        { priorCallId: bestCb.callId, priorJobId: bestCb.jobId },
        'system',
      );
      logReceptionistHardening('duplicate_booking_cross_call_merged', { callId, priorJobId: bestCb.jobId });
      const callRow = (await sql`SELECT call_log_id FROM receptionist_calls WHERE id = ${callId}`)[0] as Record<
        string,
        unknown
      >;
      if (callRow.call_log_id) {
        await sql`
          UPDATE call_logs SET job_id = ${bestCb.jobId}, outcome = 'booked', updated_at = datetime('now')
          WHERE id = ${callRow.call_log_id}
        `;
      }
      return {
        bookingId: bestCb.bookingId,
        jobId: bestCb.jobId,
        duplicate: true as const,
        crossCallMerged: true as const,
      };
    }

    if (bestCb && bestCb.rank.confidence === 'medium' && !shouldMergeCb) {
      await mergeReceptionistMetaPartial(callId, {
        duplicateResolution: {
          outcome: 'potential_duplicate_noted',
          recordType: 'callback',
          priorCallId: bestCb.callId,
          priorBookingId: bestCb.bookingId,
          confidence: 'medium',
          rationale: bestCb.rank.rationale,
          at: new Date().toISOString(),
        },
        duplicateNotes: [`potential_dup_prior_call:${bestCb.callId}`],
      });
      logReceptionistHardening('duplicate_booking_cross_call_hint', { callId, matches: 1 });
    }

    const companyId = await getCompanyIdForReceptionist();
    const { scheduledDate, scheduledTime } = suggestScheduleForBooking(
      'callback',
      extracted,
      rules.timezone || 'America/Toronto',
    );

    const bookingRows = await sql`
      INSERT INTO receptionist_bookings (
        call_id, booking_type, status,
        requested_window_start, requested_window_end,
        scheduled_start, scheduled_end,
        notes
      )
      VALUES (
        ${callId},
        'callback',
        'requested',
        ${scheduledDate},
        ${null},
        ${scheduledDate + 'T' + scheduledTime + ':00.000Z'},
        ${null},
        ${extracted.preferredCallbackWindow || 'Callback per AI receptionist'}
      )
      RETURNING id
    `;

    const job = await createJobForBooking({
      companyId,
      leadId: (call.lead_id as string) || null,
      customerId: null,
      type: 'Callback',
      description: `AI receptionist callback: ${extracted.issueDescription || extracted.summary || ''}`,
      scheduledDate,
      scheduledTime,
      notes: extracted.preferredCallbackWindow || null,
    });

    await sql`
      UPDATE receptionist_bookings SET job_id = ${job.id as string}, status = 'scheduled', updated_at = datetime('now')
      WHERE id = ${bookingRows[0].id as string}
    `;

    await linkJobToCall(callId, job.id as string);

    await sql`
      UPDATE receptionist_calls
      SET disposition = ${'callback_booked' satisfies ReceptionistDisposition},
          job_id = ${job.id as string},
          updated_at = datetime('now')
      WHERE id = ${callId}
    `;

    await mergeReceptionistMetaPartial(callId, {
      internalOutcome: 'booking_confirmed',
      duplicateResolution: {
        outcome: 'new_record',
        recordType: 'callback',
        at: new Date().toISOString(),
      },
    });

    const callRow = (await sql`SELECT call_log_id FROM receptionist_calls WHERE id = ${callId}`)[0] as Record<
      string,
      unknown
    >;
    if (callRow.call_log_id) {
      await sql`
        UPDATE call_logs SET job_id = ${job.id as string}, outcome = 'booked', updated_at = datetime('now')
        WHERE id = ${callRow.call_log_id}
      `;
    }

    return { bookingId: bookingRows[0].id as string, jobId: job.id as string, duplicate: false as const };
  },

  async bookQuoteVisitFromCall(
    callId: string,
    opts?: { skipAddressGuard?: boolean },
  ) {
    const settings = await ensureReceptionistSettings();
    if (!settings.quote_visit_booking_enabled) {
      throw new Error('Quote visit booking is disabled in receptionist settings');
    }
    const detail = await getReceptionistCallDetail(callId);
    if (!detail) throw new Error('Call not found');
    const call = detail.call as Record<string, unknown>;
    let extracted = parseExtracted(call);
    if (!extracted) {
      extracted = buildExtractedFallbackFromCallRow(call);
    }

    const rules = parseBookingRulesExtended(settings.booking_rules_json);
    const existing = await findActiveBookingOnCall(callId, 'quote_visit');
    if (existing) {
      await mergeReceptionistMetaPartial(callId, {
        internalOutcome: 'booking_duplicate_merged',
        duplicateNotes: [`same_call_booking:${existing.id}`],
        duplicateResolution: {
          outcome: 'same_call_reused',
          recordType: 'quote_visit',
          priorBookingId: existing.id,
          priorJobId: existing.job_id || undefined,
          confidence: 'high',
          rationale: ['same_receptionist_call_active_booking'],
          at: new Date().toISOString(),
        },
      });
      logReceptionistHardening('duplicate_booking_same_call', {
        callId,
        bookingId: existing.id,
        bookingType: 'quote_visit',
      });
      if (!existing.job_id) throw new Error('Existing quote booking is missing a linked job');
      return { bookingId: existing.id, jobId: existing.job_id, duplicate: true as const };
    }

    const priorTool = await getLastSuccessfulToolPayload(callId, 'book_quote_visit');
    if (priorTool?.jobId) {
      return {
        bookingId: String(priorTool.bookingId || priorTool.booking_id || ''),
        jobId: String(priorTool.jobId),
        duplicate: true as const,
        idempotentReplay: true as const,
      };
    }

    if (!looksLikeServiceAddress(extracted.address) && !opts?.skipAddressGuard) {
      logReceptionistHardening('booking_validation_failed', { callId, field: 'address' });
      throw new Error('Quote visit requires a service address with street detail');
    }

    const phoneNorm = normalizePhoneDigits(extracted.phone || (call.from_phone as string) || '');
    const isEm = callIsEmergency(extracted, call);
    const windowH = Math.min(
      72,
      Math.max(2, Math.ceil((rules.duplicateWindowMinutes ?? 120) / 60)),
    );
    const qCandidates = await listCrossCallBookingCandidates({
      excludeCallId: callId,
      bookingType: 'quote_visit',
      windowHours: isEm ? EMERGENCY_CROSS_CALL_WINDOW_HOURS : windowH,
    });

    let bestQ: {
      bookingId: string;
      callId: string;
      jobId: string | null;
      rank: ReturnType<typeof rankBookingDuplicate>;
    } | null = null;
    for (const c of qCandidates) {
      const rank = rankBookingDuplicate(extracted, phoneNorm, c);
      if (!bestQ || rank.score > bestQ.rank.score) {
        bestQ = { bookingId: c.bookingId, callId: c.callId, jobId: c.jobId, rank };
      }
    }

    const shouldMergeQ =
      bestQ &&
      bestQ.jobId &&
      phoneNorm.length >= 10 &&
      (bestQ.rank.confidence === 'high' ||
        (bestQ.rank.confidence === 'medium' && isEm) ||
        (isEm && bestQ.rank.score >= 55));

    if (shouldMergeQ && bestQ && bestQ.jobId) {
      await linkJobToCall(callId, bestQ.jobId);
      await sql`
        UPDATE receptionist_calls
        SET disposition = ${'quote_visit_booked' satisfies ReceptionistDisposition},
            job_id = ${bestQ.jobId},
            updated_at = datetime('now')
        WHERE id = ${callId}
      `;
      await mergeReceptionistMetaPartial(callId, {
        internalOutcome: 'booking_duplicate_merged',
        duplicateResolution: {
          ...duplicateResolutionBase('quote_visit', bestQ.rank.rationale),
          priorCallId: bestQ.callId,
          priorBookingId: bestQ.bookingId,
          priorJobId: bestQ.jobId,
          confidence: bestQ.rank.confidence,
        },
      });
      await logReceptionistEvent(
        callId,
        'duplicate_booking_cross_call_merged',
        { priorCallId: bestQ.callId, priorJobId: bestQ.jobId, bookingType: 'quote_visit' },
        'system',
      );
      const row = (await sql`SELECT call_log_id FROM receptionist_calls WHERE id = ${callId}`)[0] as Record<
        string,
        unknown
      >;
      if (row.call_log_id) {
        await sql`
          UPDATE call_logs SET job_id = ${bestQ.jobId}, outcome = 'booked', updated_at = datetime('now')
          WHERE id = ${row.call_log_id}
        `;
      }
      return {
        bookingId: bestQ.bookingId,
        jobId: bestQ.jobId,
        duplicate: true as const,
        crossCallMerged: true as const,
      };
    }

    if (bestQ && bestQ.rank.confidence === 'medium' && !shouldMergeQ) {
      await mergeReceptionistMetaPartial(callId, {
        duplicateResolution: {
          outcome: 'potential_duplicate_noted',
          recordType: 'quote_visit',
          priorCallId: bestQ.callId,
          priorBookingId: bestQ.bookingId,
          confidence: 'medium',
          rationale: bestQ.rank.rationale,
          at: new Date().toISOString(),
        },
        duplicateNotes: [`potential_dup_prior_call:${bestQ.callId}`],
      });
    }

    const companyId = await getCompanyIdForReceptionist();
    const { scheduledDate, scheduledTime } = suggestScheduleForBooking(
      'quote_visit',
      extracted,
      rules.timezone || 'America/Toronto',
    );

    const bookingRows = await sql`
      INSERT INTO receptionist_bookings (
        call_id, booking_type, status,
        requested_window_start, requested_window_end,
        scheduled_start, scheduled_end,
        notes
      )
      VALUES (
        ${callId},
        'quote_visit',
        'requested',
        ${scheduledDate},
        ${null},
        ${scheduledDate + 'T' + scheduledTime + ':00.000Z'},
        ${null},
        ${extracted.preferredVisitWindow || 'On-site estimate'}
      )
      RETURNING id
    `;

    const job = await createJobForBooking({
      companyId,
      leadId: (call.lead_id as string) || null,
      customerId: null,
      type: 'Estimate visit',
      description: `Quote / estimate visit: ${extracted.issueDescription || extracted.summary || ''}`,
      scheduledDate,
      scheduledTime,
      notes: extracted.preferredVisitWindow || null,
    });

    await sql`
      UPDATE receptionist_bookings SET job_id = ${job.id as string}, status = 'scheduled', updated_at = datetime('now')
      WHERE id = ${bookingRows[0].id as string}
    `;

    await linkJobToCall(callId, job.id as string);

    await sql`
      UPDATE receptionist_calls
      SET disposition = ${'quote_visit_booked' satisfies ReceptionistDisposition},
          job_id = ${job.id as string},
          updated_at = datetime('now')
      WHERE id = ${callId}
    `;

    await mergeReceptionistMetaPartial(callId, {
      internalOutcome: 'booking_confirmed',
      duplicateResolution: {
        outcome: 'new_record',
        recordType: 'quote_visit',
        at: new Date().toISOString(),
      },
    });

    const row = (await sql`SELECT call_log_id FROM receptionist_calls WHERE id = ${callId}`)[0] as Record<
      string,
      unknown
    >;
    if (row.call_log_id) {
      await sql`
        UPDATE call_logs SET job_id = ${job.id as string}, outcome = 'booked', updated_at = datetime('now')
        WHERE id = ${row.call_log_id}
      `;
    }

    return { bookingId: bookingRows[0].id as string, jobId: job.id as string, duplicate: false as const };
  },

  async markEmergency(callId: string) {
    await sql`
      UPDATE receptionist_calls
      SET disposition = 'emergency', urgency = 'emergency', updated_at = datetime('now')
      WHERE id = ${callId}
    `;
    await sql`
      INSERT INTO receptionist_events (call_id, event_type, payload_json, source)
      VALUES (${callId}, 'emergency_flagged', ${JSON.stringify({})}, ${'system'})
    `;
    const detail = await getReceptionistCallDetail(callId);
    const meta = detail
      ? parseReceptionistMeta((detail.call as Record<string, unknown>).receptionist_meta_json as string | undefined)
      : {};
    const wasPreviouslySpam = meta.callerBehavior === 'spam_or_prank';
    await mergeReceptionistMetaPartial(callId, {
      internalOutcome: 'emergency_flagged_pending_human',
      emergencyTier: 'emergency',
      callerBehavior: 'emergency_legitimate',
      behaviorRationale: wasPreviouslySpam
        ? 'Emergency flagged after prior spam classification — emergency takes priority'
        : 'Emergency flagged',
      operationalPriority: 'emergency_callback_required',
      toolFallbacks: [{ tool: 'flag_emergency', action: 'recorded', reason: 'manual_or_tool_flag' }],
    });
    logReceptionistHardening('emergency_flagged', { callId, previousBehavior: meta.callerBehavior });

    const call = detail?.call as Record<string, unknown> | undefined;
    if (call && !call.job_id) {
      await ensureEmergencyHumanFollowUpTask(callId);
    }
  },

  async recordToolFailureFallback(
    callId: string,
    tool: string,
    message: string,
    internalOutcome: InternalBookingOutcome,
  ) {
    await mergeReceptionistMetaPartial(callId, {
      internalOutcome,
      lastToolError: { tool, message, at: new Date().toISOString() },
      toolFallbacks: [{ tool, action: 'fallback_follow_up', reason: message.slice(0, 120) }],
    });
    await sql`
      UPDATE receptionist_calls SET disposition = ${'follow_up_needed' satisfies ReceptionistDisposition}, updated_at = datetime('now')
      WHERE id = ${callId}
    `;
    await logReceptionistEvent(callId, 'tool_failure_fallback', { tool, internalOutcome }, 'system');
    logReceptionistHardening('tool_failure_fallback', { callId, tool, internalOutcome });
  },

  async markSpam(callId: string) {
    const detail = await getReceptionistCallDetail(callId);
    if (detail) {
      const call = detail.call as Record<string, unknown>;
      const spamMeta = parseReceptionistMeta(call.receptionist_meta_json as string | undefined);
      const isEmergency =
        call.disposition === 'emergency' ||
        spamMeta.emergencyTier === 'emergency' ||
        spamMeta.callerBehavior === 'emergency_legitimate';
      if (isEmergency) {
        logReceptionistHardening('mark_spam_blocked_emergency', { callId });
        await mergeReceptionistMetaPartial(callId, {
          callerBehavior: 'abusive_but_legitimate',
          behaviorRationale: 'mark_spam called but emergency was already detected — reclassified as abusive_but_legitimate',
          spamRationale: [...(spamMeta.spamRationale || []), 'mark_spam_attempted_post_emergency'],
        });
        return;
      }
      const hasPlumbing =
        spamMeta.callerBehavior === 'legitimate_plumbing' ||
        spamMeta.callerBehavior === 'abusive_but_legitimate';
      if (hasPlumbing) {
        logReceptionistHardening('mark_spam_softened_to_abusive', { callId });
        await mergeReceptionistMetaPartial(callId, {
          callerBehavior: 'abusive_but_legitimate',
          behaviorRationale:
            'mark_spam called but legitimate plumbing content detected — reclassified as abusive_but_legitimate',
        });
        return;
      }
    }
    await updateCallDisposition(callId, 'spam');
    await mergeReceptionistMetaPartial(callId, {
      callerBehavior: 'spam_or_prank',
      behaviorRationale: 'Marked as spam via tool or UI',
    });
  },

  async setDisposition(callId: string, disposition: ReceptionistDisposition) {
    await updateCallDisposition(callId, disposition);
  },
};
