import { sql } from '@/lib/db';
import { MOCK_SCENARIOS, getScenarioById } from '@/lib/receptionist/scenarios';
import {
  decideDisposition,
  dispositionToRecommendedStep,
  extractCallFieldsFromTranscript,
  parseEmergencyKeywordsJson,
} from '@/lib/receptionist/extract';
import {
  createCallLogForReceptionistCall,
  getCompanyIdForReceptionist,
  linkReceptionistCallToCallLog,
} from '@/lib/receptionist/integrations';
import { logReceptionistHardening, synthesizeReceptionistCallMeta } from '@/lib/receptionist/hardening';
import { mergeReceptionistMeta } from '@/lib/receptionist/hardening/merge-meta';
import type { ReceptionistCallMeta } from '@/lib/receptionist/hardening/types';
import { enrichReceptionistMetaAfterSynthesis } from '@/lib/receptionist/enrich-receptionist-meta';
import { listStaffTasksForCall, countOpenUrgentStaffTasks } from '@/lib/receptionist/staff-handoff';
import type {
  ExtractedCallData,
  ReceptionistDisposition,
  ReceptionistSettingsRow,
} from '@/lib/receptionist/types';

export async function syncMockScenariosToDb() {
  for (let i = 0; i < MOCK_SCENARIOS.length; i++) {
    const s = MOCK_SCENARIOS[i];
    await sql`
      INSERT INTO receptionist_mock_scenarios (id, name, description, transcript_script_json, expected_outcome, is_default)
      VALUES (
        ${s.id},
        ${s.name},
        ${s.description},
        ${JSON.stringify(s.turns)},
        ${s.expectedOutcome},
        ${i === 0 ? 1 : 0}
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        transcript_script_json = excluded.transcript_script_json,
        expected_outcome = excluded.expected_outcome
    `;
  }
}

export async function ensureReceptionistSettings(
  companyId?: string | null,
): Promise<ReceptionistSettingsRow> {
  const rows = companyId
    ? ((await sql`
        SELECT * FROM receptionist_settings
        WHERE company_id = ${companyId}
        ORDER BY created_at ASC LIMIT 1
      `) as unknown as ReceptionistSettingsRow[])
    : ((await sql`
        SELECT * FROM receptionist_settings ORDER BY created_at ASC LIMIT 1
      `) as unknown as ReceptionistSettingsRow[]);

  if (rows.length > 0) {
    const r = rows[0] as unknown as ReceptionistSettingsRow;
    return { ...r, retell_agent_id: r.retell_agent_id ?? null };
  }

  const company = companyId
    ? await sql`SELECT name FROM companies WHERE id = ${companyId} LIMIT 1`
    : await sql`SELECT name FROM companies ORDER BY created_at ASC LIMIT 1`;
  const companyName = (company[0]?.name as string) || 'WNY Automation Portal';

  const inserted = (await sql`
    INSERT INTO receptionist_settings (
      company_id,
      company_name,
      greeting,
      disclosure_enabled,
      recording_enabled,
      business_hours_json,
      after_hours_mode,
      allowed_actions_json,
      emergency_keywords_json,
      booking_rules_json,
      default_call_outcome_rules_json,
      provider_type,
      provider_config_json,
      internal_instructions,
      callback_booking_enabled,
      quote_visit_booking_enabled,
      retell_agent_id
    )
    VALUES (
      ${companyId || null},
      ${companyName},
      ${`Thanks for calling ${companyName}. I'm an AI assistant — how can we help?`},
      1,
      0,
      ${JSON.stringify({ monFri: '8:00-17:00', sat: 'closed', sun: 'closed' })},
      'message_and_callback',
      ${JSON.stringify(['callback', 'quote_visit', 'lead', 'emergency'])},
      ${JSON.stringify(['burst pipe', 'flooding', 'sewer backup', 'gas smell'])},
      ${JSON.stringify({ minNoticeHours: 4, duplicateWindowMinutes: 120, timezone: 'America/Toronto', spamKeywords: [] })},
      ${JSON.stringify({ defaultDisposition: 'follow_up_needed' })},
      'mock',
      ${JSON.stringify({ note: 'Non-secret provider options only' })},
      ${'Never quote exact prices. Escalate emergencies. Confirm bookings before promising arrival times.'},
      1,
      1,
      NULL
    )
    RETURNING *
  `) as unknown as ReceptionistSettingsRow[];

  const ins = inserted[0] as unknown as ReceptionistSettingsRow;
  return { ...ins, retell_agent_id: ins.retell_agent_id ?? null };
}

export async function updateReceptionistSettings(
  patch: Partial<{
    company_name: string | null;
    greeting: string | null;
    disclosure_enabled: boolean;
    recording_enabled: boolean;
    business_hours_json: string | null;
    after_hours_mode: string | null;
    allowed_actions_json: string | null;
    emergency_keywords_json: string | null;
    booking_rules_json: string | null;
    default_call_outcome_rules_json: string | null;
    provider_type: string;
    provider_config_json: string | null;
    internal_instructions: string | null;
    callback_booking_enabled: boolean;
    quote_visit_booking_enabled: boolean;
    retell_agent_id?: string | null;
  }>,
) {
  const current = await ensureReceptionistSettings();
  const next = {
    company_name: patch.company_name ?? current.company_name,
    greeting: patch.greeting ?? current.greeting,
    disclosure_enabled:
      patch.disclosure_enabled !== undefined
        ? patch.disclosure_enabled
          ? 1
          : 0
        : current.disclosure_enabled,
    recording_enabled:
      patch.recording_enabled !== undefined
        ? patch.recording_enabled
          ? 1
          : 0
        : current.recording_enabled,
    business_hours_json: patch.business_hours_json ?? current.business_hours_json,
    after_hours_mode: patch.after_hours_mode ?? current.after_hours_mode,
    allowed_actions_json: patch.allowed_actions_json ?? current.allowed_actions_json,
    emergency_keywords_json: patch.emergency_keywords_json ?? current.emergency_keywords_json,
    booking_rules_json: patch.booking_rules_json ?? current.booking_rules_json,
    default_call_outcome_rules_json:
      patch.default_call_outcome_rules_json ?? current.default_call_outcome_rules_json,
    provider_type: patch.provider_type ?? current.provider_type,
    provider_config_json: patch.provider_config_json ?? current.provider_config_json,
    internal_instructions: patch.internal_instructions ?? current.internal_instructions,
    callback_booking_enabled:
      patch.callback_booking_enabled !== undefined
        ? patch.callback_booking_enabled
          ? 1
          : 0
        : current.callback_booking_enabled,
    quote_visit_booking_enabled:
      patch.quote_visit_booking_enabled !== undefined
        ? patch.quote_visit_booking_enabled
          ? 1
          : 0
        : current.quote_visit_booking_enabled,
    retell_agent_id:
      patch.retell_agent_id !== undefined ? patch.retell_agent_id : current.retell_agent_id ?? null,
  };

  await sql`
    UPDATE receptionist_settings SET
      company_name = ${next.company_name},
      greeting = ${next.greeting},
      disclosure_enabled = ${next.disclosure_enabled},
      recording_enabled = ${next.recording_enabled},
      business_hours_json = ${next.business_hours_json},
      after_hours_mode = ${next.after_hours_mode},
      allowed_actions_json = ${next.allowed_actions_json},
      emergency_keywords_json = ${next.emergency_keywords_json},
      booking_rules_json = ${next.booking_rules_json},
      default_call_outcome_rules_json = ${next.default_call_outcome_rules_json},
      provider_type = ${next.provider_type},
      provider_config_json = ${next.provider_config_json},
      internal_instructions = ${next.internal_instructions},
      callback_booking_enabled = ${next.callback_booking_enabled},
      quote_visit_booking_enabled = ${next.quote_visit_booking_enabled},
      retell_agent_id = ${next.retell_agent_id},
      updated_at = datetime('now')
    WHERE id = ${current.id}
  `;

  return ensureReceptionistSettings();
}

export type ReceptionistEventSource = 'mock' | 'retell' | 'twilio' | 'system';

export async function logReceptionistEvent(
  callId: string,
  eventType: string,
  payload: unknown,
  source: ReceptionistEventSource = 'system',
) {
  await sql`
    INSERT INTO receptionist_events (call_id, event_type, payload_json, source)
    VALUES (${callId}, ${eventType}, ${JSON.stringify(payload)}, ${source})
  `;
}

async function logEvent(callId: string, eventType: string, payload: unknown) {
  await logReceptionistEvent(callId, eventType, payload, 'mock');
}

export async function startMockCall(scenarioId: string) {
  await syncMockScenariosToDb();
  const scenario = getScenarioById(scenarioId);
  if (!scenario) {
    throw new Error('Unknown scenario');
  }

  const settings = await ensureReceptionistSettings();
  const baseline = scenario.extractedBaseline;
  const fromPhone =
    (baseline?.phone as string) || '(555) 000-0001';

  const rows = await sql`
    INSERT INTO receptionist_calls (
      provider,
      provider_call_id,
      direction,
      from_phone,
      to_phone,
      caller_name,
      status,
      mock_scenario_id,
      current_transcript_index,
      urgency
    )
    VALUES (
      'mock',
      ${`mock-${Date.now()}`},
      'inbound',
      ${fromPhone},
      ${'(555) PLUMBER'},
      ${(baseline?.callerName as string) || null},
      'active',
      ${scenarioId},
      0,
      ${baseline?.urgency || 'medium'}
    )
    RETURNING *
  `;

  const call = rows[0];
  await logEvent(call.id as string, 'mock_started', { scenarioId });

  return { call, scenario, settings };
}

export async function advanceMockCall(callId: string) {
  const calls = await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`;
  if (calls.length === 0) throw new Error('Call not found');
  const call = calls[0] as Record<string, unknown>;
  if (call.status === 'completed') {
    return { done: true, segment: null, call, autoCompleted: false };
  }
  const scenarioId = call.mock_scenario_id as string | null;
  if (!scenarioId) throw new Error('Not a mock call');

  const scenario = getScenarioById(scenarioId);
  if (!scenario) throw new Error('Scenario missing');

  let idx = Number(call.current_transcript_index || 0);
  if (idx >= scenario.turns.length) {
    return { done: true, segment: null, call, autoCompleted: false };
  }

  const turn = scenario.turns[idx];
  const seq = idx;

  await sql`
    INSERT INTO receptionist_transcript_segments (call_id, seq, speaker, text, timestamp_ms)
    VALUES (${callId}, ${seq}, ${turn.speaker}, ${turn.text}, ${Date.now()})
    ON CONFLICT(call_id, seq) DO NOTHING
  `;

  const segments = await sql`
    SELECT speaker, text FROM receptionist_transcript_segments
    WHERE call_id = ${callId}
    ORDER BY seq ASC
  `;
  const transcriptText = segments
    .map((s) => {
      const label =
        s.speaker === 'assistant'
          ? 'Assistant'
          : s.speaker === 'caller'
            ? 'Caller'
            : 'System';
      return `${label}: ${s.text}`;
    })
    .join('\n');

  idx += 1;
  await sql`
    UPDATE receptionist_calls
    SET
      current_transcript_index = ${idx},
      transcript_text = ${transcriptText},
      status = 'active',
      updated_at = datetime('now')
    WHERE id = ${callId}
  `;

  await logEvent(callId, 'transcript_chunk', { seq, speaker: turn.speaker });

  const updated = (await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`)[0];

  if (idx >= scenario.turns.length) {
    await finalizeReceptionistCall(callId);
    const finalCall = (await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`)[0];
    return { done: true, segment: turn, call: finalCall, autoCompleted: true };
  }

  return { done: false, segment: turn, call: updated, autoCompleted: false };
}

export async function endMockCall(callId: string, fastForwardRemaining = true) {
  const calls = await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`;
  if (calls.length === 0) throw new Error('Call not found');
  const call = calls[0] as Record<string, unknown>;
  const scenarioId = call.mock_scenario_id as string | null;

  if (call.status === 'completed') {
    return (await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`)[0];
  }

  if (fastForwardRemaining && scenarioId) {
    const scenario = getScenarioById(scenarioId);
    if (scenario) {
      for (;;) {
        const row = (await sql`
          SELECT status, current_transcript_index FROM receptionist_calls WHERE id = ${callId}
        `)[0] as Record<string, unknown>;
        if (row.status === 'completed') break;
        const idx = Number(row.current_transcript_index || 0);
        if (idx >= scenario.turns.length) {
          await finalizeReceptionistCall(callId);
          break;
        }
        await advanceMockCall(callId);
      }
    }
  } else {
    await finalizeReceptionistCall(callId);
  }

  return (await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`)[0];
}

export async function finalizeReceptionistCall(callId: string) {
  const calls = await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`;
  if (calls.length === 0) throw new Error('Call not found');
  const call = calls[0] as Record<string, unknown>;
  if (call.status === 'completed') {
    return call;
  }

  const settings = await ensureReceptionistSettings();
  const scenario = call.mock_scenario_id
    ? (getScenarioById(call.mock_scenario_id as string) ?? null)
    : null;

  const transcript = (call.transcript_text as string) || '';
  const keywords = parseEmergencyKeywordsJson(settings.emergency_keywords_json);
  const extracted = extractCallFieldsFromTranscript(transcript, scenario, keywords);
  let disposition = decideDisposition(extracted, scenario);

  const started = call.started_at ? new Date(call.started_at as string).getTime() : Date.now();
  const durationSeconds = Math.max(0, Math.round((Date.now() - started) / 1000));

  const bookings =
    (await sql`SELECT booking_type, status FROM receptionist_bookings WHERE call_id = ${callId}`) as {
      booking_type: string;
      status: string;
    }[];
  const toolInvocations =
    (await sql`SELECT tool_name, status FROM receptionist_tool_invocations WHERE call_id = ${callId}`) as {
      tool_name: string;
      status: string;
    }[];
  const events =
    (await sql`SELECT event_type FROM receptionist_events WHERE call_id = ${callId}`) as { event_type: string }[];

  const syn = synthesizeReceptionistCallMeta({
    callRow: call,
    extracted,
    disposition,
    bookings,
    toolInvocations,
    events,
    settings,
    durationSeconds,
  });
  if (syn.completenessDowngraded) {
    logReceptionistHardening('completeness_downgrade', {
      callId,
      fromDisposition: disposition,
      toDisposition: syn.adjustedDisposition,
    });
  }
  disposition = syn.adjustedDisposition;
  const finalExtracted = syn.adjustedExtracted;
  const recommended = dispositionToRecommendedStep(disposition, finalExtracted);

  const companyIdForMeta = await getCompanyIdForReceptionist();
  const enrichedMetaJson = await enrichReceptionistMetaAfterSynthesis({
    companyId: companyIdForMeta,
    callId,
    callRow: { ...call, recommended_next_step: recommended },
    extracted: finalExtracted,
    disposition,
    mergedMetaJson: syn.mergedMetaJson,
    toolInvocations,
    events,
  });

  await sql`
    UPDATE receptionist_calls SET
      caller_name = ${finalExtracted.callerName},
      from_phone = COALESCE(${finalExtracted.phone}, from_phone),
      extracted_json = ${JSON.stringify(finalExtracted)},
      ai_summary = ${finalExtracted.summary},
      recommended_next_step = ${recommended},
      disposition = ${disposition},
      urgency = ${finalExtracted.urgency},
      status = 'completed',
      ended_at = datetime('now'),
      duration_seconds = ${durationSeconds},
      receptionist_meta_json = ${enrichedMetaJson},
      updated_at = datetime('now')
    WHERE id = ${callId}
  `;

  await logEvent(callId, 'call_finalized', { disposition, recommended });

  const companyId = await getCompanyIdForReceptionist();
  const finalRow = (await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`)[0] as Record<
    string,
    unknown
  >;

  if (!finalRow.call_log_id) {
    const transcriptFull = (finalRow.transcript_text as string) || '';
    const callLogId = await createCallLogForReceptionistCall({
      companyId,
      customerName: finalExtracted.callerName,
      phoneNumber: (finalExtracted.phone as string) || (finalRow.from_phone as string) || 'unknown',
      durationSeconds,
      transcript: transcriptFull,
      aiSummary: finalExtracted.summary,
      outcome: mapDispositionToCallOutcome(disposition),
      leadId: (finalRow.lead_id as string) || null,
      jobId: (finalRow.job_id as string) || null,
      customerId: null,
      recording: Boolean(settings.recording_enabled),
    });
    await linkReceptionistCallToCallLog(callId, callLogId);
  }

  return (await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`)[0];
}

function mapDispositionToCallOutcome(disposition: ReceptionistDisposition) {
  switch (disposition) {
    case 'quote_visit_booked':
    case 'callback_booked':
      return 'booked';
    case 'lead_created':
    case 'follow_up_needed':
      return 'callback';
    case 'emergency':
      return 'callback';
    case 'spam':
      return 'not_interested';
    default:
      return 'info';
  }
}

export async function reprocessReceptionistCall(callId: string) {
  const calls = await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`;
  if (calls.length === 0) throw new Error('Call not found');
  const call = calls[0] as Record<string, unknown>;

  const settings = await ensureReceptionistSettings();
  const scenario = call.mock_scenario_id
    ? (getScenarioById(call.mock_scenario_id as string) ?? null)
    : null;
  const transcript = (call.transcript_text as string) || '';
  const keywords = parseEmergencyKeywordsJson(settings.emergency_keywords_json);
  const extracted = extractCallFieldsFromTranscript(transcript, scenario, keywords);
  let disposition = decideDisposition(extracted, scenario);

  const bookings =
    (await sql`SELECT booking_type, status FROM receptionist_bookings WHERE call_id = ${callId}`) as {
      booking_type: string;
      status: string;
    }[];
  const toolInvocations =
    (await sql`SELECT tool_name, status FROM receptionist_tool_invocations WHERE call_id = ${callId}`) as {
      tool_name: string;
      status: string;
    }[];
  const events =
    (await sql`SELECT event_type FROM receptionist_events WHERE call_id = ${callId}`) as { event_type: string }[];

  const syn = synthesizeReceptionistCallMeta({
    callRow: call,
    extracted,
    disposition,
    bookings,
    toolInvocations,
    events,
    settings,
    durationSeconds: Number(call.duration_seconds || 0),
  });
  if (syn.completenessDowngraded) {
    logReceptionistHardening('completeness_downgrade', {
      callId,
      fromDisposition: disposition,
      toDisposition: syn.adjustedDisposition,
    });
  }
  disposition = syn.adjustedDisposition;
  const reExtracted = syn.adjustedExtracted;
  const recommended = dispositionToRecommendedStep(disposition, reExtracted);

  const companyIdRe = await getCompanyIdForReceptionist();
  const enrichedReprocess = await enrichReceptionistMetaAfterSynthesis({
    companyId: companyIdRe,
    callId,
    callRow: { ...call, recommended_next_step: recommended },
    extracted: reExtracted,
    disposition,
    mergedMetaJson: syn.mergedMetaJson,
    toolInvocations,
    events,
  });

  await sql`
    UPDATE receptionist_calls SET
      caller_name = ${reExtracted.callerName},
      from_phone = COALESCE(${reExtracted.phone}, from_phone),
      extracted_json = ${JSON.stringify(reExtracted)},
      ai_summary = ${reExtracted.summary},
      recommended_next_step = ${recommended},
      disposition = ${disposition},
      urgency = ${reExtracted.urgency},
      receptionist_meta_json = ${enrichedReprocess},
      updated_at = datetime('now')
    WHERE id = ${callId}
  `;

  await logReceptionistEvent(callId, 'manual_reprocess', {}, 'system');

  if (call.call_log_id) {
    await sql`
      UPDATE call_logs SET
        transcript = ${transcript},
        ai_summary = ${reExtracted.summary},
        outcome = ${mapDispositionToCallOutcome(disposition)},
        customer_name = ${reExtracted.callerName},
        phone_number = COALESCE(${reExtracted.phone}, phone_number),
        updated_at = datetime('now')
      WHERE id = ${call.call_log_id}
    `;
  }

  return (await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`)[0];
}

export async function listReceptionistCalls(
  page: number,
  limit: number,
  opts?: { companyId?: string },
) {
  const offset = (page - 1) * limit;
  const hasCompanyColumn = await receptionistCallsHasCompanyId();
  if (opts?.companyId && hasCompanyColumn) {
    const rows = await sql`
      SELECT rc.*, l.issue as lead_issue
      FROM receptionist_calls rc
      LEFT JOIN leads l ON rc.lead_id = l.id
      WHERE rc.company_id = ${opts.companyId}
      ORDER BY rc.started_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countRow = await sql`
      SELECT COUNT(*) as total FROM receptionist_calls WHERE company_id = ${opts.companyId}
    `;
    const total = Number(countRow[0]?.total || 0);
    return { calls: rows, total };
  }

  const rows = await sql`
    SELECT rc.*, l.issue as lead_issue
    FROM receptionist_calls rc
    LEFT JOIN leads l ON rc.lead_id = l.id
    ORDER BY rc.started_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const countRow = await sql`SELECT COUNT(*) as total FROM receptionist_calls`;
  const total = Number(countRow[0]?.total || 0);
  return { calls: rows, total };
}

let _receptionistCallsCompanyIdChecked = false;
let _receptionistCallsHasCompanyId = false;
async function receptionistCallsHasCompanyId(): Promise<boolean> {
  if (_receptionistCallsCompanyIdChecked) return _receptionistCallsHasCompanyId;
  try {
    const rows = (await sql`PRAGMA table_info(receptionist_calls)`) as unknown as Array<{
      name: string;
    }>;
    _receptionistCallsHasCompanyId = rows.some((r) => r.name === 'company_id');
  } catch {
    _receptionistCallsHasCompanyId = false;
  }
  _receptionistCallsCompanyIdChecked = true;
  return _receptionistCallsHasCompanyId;
}

export async function getReceptionistCallDetail(callId: string) {
  const calls = await sql`
    SELECT rc.*, l.issue as lead_issue, j.type as job_type, j.scheduled_date, j.scheduled_time
    FROM receptionist_calls rc
    LEFT JOIN leads l ON rc.lead_id = l.id
    LEFT JOIN jobs j ON rc.job_id = j.id
    WHERE rc.id = ${callId}
  `;
  if (calls.length === 0) return null;
  const segments = await sql`
    SELECT * FROM receptionist_transcript_segments WHERE call_id = ${callId} ORDER BY seq ASC
  `;
  const events = await sql`
    SELECT * FROM receptionist_events WHERE call_id = ${callId} ORDER BY created_at ASC
  `;
  const bookings = await sql`
    SELECT * FROM receptionist_bookings WHERE call_id = ${callId} ORDER BY created_at ASC
  `;
  const toolInvocations = await sql`
    SELECT * FROM receptionist_tool_invocations WHERE call_id = ${callId} ORDER BY created_at ASC
  `;
  const staffTasks = await listStaffTasksForCall(callId);
  return { call: calls[0], segments, events, bookings, toolInvocations, staffTasks };
}

export async function getDashboardStats() {
  const totalRow = await sql`SELECT COUNT(*) as c FROM receptionist_calls`;
  const activeRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_calls
    WHERE status IN ('mock', 'active', 'ringing')
       OR provider_status IN ('registered', 'ongoing', 'not_connected')
  `;
  const cbRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_bookings WHERE booking_type = 'callback' AND status != 'cancelled'
  `;
  const qvRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_bookings WHERE booking_type = 'quote_visit' AND status != 'cancelled'
  `;
  const emRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_calls WHERE disposition = 'emergency'
  `;
  const fuRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_calls WHERE disposition = 'follow_up_needed'
  `;
  const spamRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_calls WHERE disposition = 'spam'
  `;
  const incompleteRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_calls
    WHERE receptionist_meta_json IS NOT NULL
      AND json_extract(receptionist_meta_json, '$.completeness.sufficient') = 0
  `;

  const urgentRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_calls
    WHERE receptionist_meta_json IS NOT NULL
      AND json_extract(receptionist_meta_json, '$.operationalPriority') IN ('emergency_callback_required','emergency_dispatch_review','emergency_incomplete_but_urgent')
  `;
  const abusiveRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_calls
    WHERE receptionist_meta_json IS NOT NULL
      AND json_extract(receptionist_meta_json, '$.callerBehavior') = 'abusive_but_legitimate'
  `;
  const dupMergedRow = await sql`
    SELECT COUNT(*) as c FROM receptionist_calls
    WHERE receptionist_meta_json IS NOT NULL
      AND json_extract(receptionist_meta_json, '$.duplicateResolution.outcome') = 'cross_call_merged'
  `;
  const openUrgentTasks = await countOpenUrgentStaffTasks();

  return {
    totalCalls: Number(totalRow[0]?.c || 0),
    activeCalls: Number(activeRow[0]?.c || 0),
    callbackBookings: Number(cbRow[0]?.c || 0),
    quoteVisitBookings: Number(qvRow[0]?.c || 0),
    emergenciesFlagged: Number(emRow[0]?.c || 0),
    followUpNeeded: Number(fuRow[0]?.c || 0),
    spamCalls: Number(spamRow[0]?.c || 0),
    incompleteChecklist: Number(incompleteRow[0]?.c || 0),
    urgentActionNeeded: Number(urgentRow[0]?.c || 0),
    abusiveButLegitimate: Number(abusiveRow[0]?.c || 0),
    crossCallDuplicatesMerged: Number(dupMergedRow[0]?.c || 0),
    openUrgentStaffTasks: openUrgentTasks,
  };
}

export async function mergeReceptionistMetaPartial(callId: string, patch: Partial<ReceptionistCallMeta>) {
  const rows = await sql`SELECT receptionist_meta_json FROM receptionist_calls WHERE id = ${callId}`;
  if (!rows.length) return;
  const next = mergeReceptionistMeta(rows[0].receptionist_meta_json as string | undefined, patch);
  await sql`
    UPDATE receptionist_calls SET receptionist_meta_json = ${next}, updated_at = datetime('now') WHERE id = ${callId}
  `;
}

export async function persistReceptionistHardeningForCall(callId: string) {
  const settings = await ensureReceptionistSettings();
  const call = (await sql`SELECT * FROM receptionist_calls WHERE id = ${callId}`)[0] as
    | Record<string, unknown>
    | undefined;
  if (!call) return;
  let extracted: ExtractedCallData;
  try {
    extracted = JSON.parse((call.extracted_json as string) || '{}') as ExtractedCallData;
  } catch {
    return;
  }
  const disposition = call.disposition as ReceptionistDisposition;
  const bookings =
    (await sql`SELECT booking_type, status FROM receptionist_bookings WHERE call_id = ${callId}`) as {
      booking_type: string;
      status: string;
    }[];
  const toolInvocations =
    (await sql`SELECT tool_name, status FROM receptionist_tool_invocations WHERE call_id = ${callId}`) as {
      tool_name: string;
      status: string;
    }[];
  const events =
    (await sql`SELECT event_type FROM receptionist_events WHERE call_id = ${callId}`) as { event_type: string }[];

  const syn = synthesizeReceptionistCallMeta({
    callRow: call,
    extracted,
    disposition,
    bookings,
    toolInvocations,
    events,
    settings,
    durationSeconds: Number(call.duration_seconds || 0),
  });
  if (syn.completenessDowngraded) {
    logReceptionistHardening('completeness_downgrade', {
      callId,
      fromDisposition: disposition,
      toDisposition: syn.adjustedDisposition,
    });
  }
  const hardenedExtracted = syn.adjustedExtracted;
  const recommended = dispositionToRecommendedStep(syn.adjustedDisposition, hardenedExtracted);

  const companyIdPh = await getCompanyIdForReceptionist();
  const enrichedPersist = await enrichReceptionistMetaAfterSynthesis({
    companyId: companyIdPh,
    callId,
    callRow: { ...call, recommended_next_step: recommended },
    extracted: hardenedExtracted,
    disposition: syn.adjustedDisposition,
    mergedMetaJson: syn.mergedMetaJson,
    toolInvocations,
    events,
  });

  await sql`
    UPDATE receptionist_calls SET
      caller_name = COALESCE(${hardenedExtracted.callerName}, caller_name),
      from_phone = COALESCE(${hardenedExtracted.phone}, from_phone),
      extracted_json = ${JSON.stringify(hardenedExtracted)},
      disposition = ${syn.adjustedDisposition},
      urgency = ${hardenedExtracted.urgency},
      receptionist_meta_json = ${enrichedPersist},
      recommended_next_step = ${recommended},
      updated_at = datetime('now')
    WHERE id = ${callId}
  `;
}

/** Duplicate booking on same call row (idempotent tool retries). */
export async function findActiveBookingOnCall(callId: string, bookingType: string) {
  const rows = await sql`
    SELECT id, job_id, status FROM receptionist_bookings
    WHERE call_id = ${callId} AND booking_type = ${bookingType}
      AND status IN ('scheduled', 'requested')
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] as { id: string; job_id: string | null; status: string } | undefined;
}

/** Cross-call duplicate heuristic: same phone + booking type in recent window. */
export async function findRecentDuplicateBooking(params: {
  excludeCallId: string;
  phone: string;
  bookingType: string;
  windowMinutes: number;
}) {
  const mod = `-${params.windowMinutes} minutes`;
  const rows = await sql`
    SELECT b.id, b.call_id FROM receptionist_bookings b
    INNER JOIN receptionist_calls c ON c.id = b.call_id
    WHERE b.booking_type = ${params.bookingType}
      AND b.status IN ('scheduled', 'requested')
      AND c.from_phone = ${params.phone}
      AND b.call_id != ${params.excludeCallId}
      AND datetime(b.created_at) > datetime('now', ${mod})
    ORDER BY b.created_at DESC LIMIT 3
  `;
  return rows as { id: string; call_id: string }[];
}

export async function listMockScenariosFromDb() {
  await syncMockScenariosToDb();
  return sql`SELECT * FROM receptionist_mock_scenarios ORDER BY is_default DESC, name ASC`;
}

export async function updateCallDisposition(callId: string, disposition: ReceptionistDisposition) {
  await sql`
    UPDATE receptionist_calls
    SET disposition = ${disposition}, updated_at = datetime('now')
    WHERE id = ${callId}
  `;
  await logReceptionistEvent(callId, 'disposition_updated', { disposition }, 'system');
}

export async function linkLeadToCall(callId: string, leadId: string) {
  await sql`
    UPDATE receptionist_calls SET lead_id = ${leadId}, updated_at = datetime('now') WHERE id = ${callId}
  `;
  await logReceptionistEvent(callId, 'lead_linked', { leadId }, 'system');
}

export async function linkJobToCall(callId: string, jobId: string) {
  await sql`
    UPDATE receptionist_calls SET job_id = ${jobId}, updated_at = datetime('now') WHERE id = ${callId}
  `;
  await logReceptionistEvent(callId, 'job_linked', { jobId }, 'system');
}

export async function findReceptionistCallByTwilioSid(twilioCallSid: string) {
  const rows = await sql`
    SELECT * FROM receptionist_calls WHERE twilio_call_sid = ${twilioCallSid} LIMIT 1
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

export async function findReceptionistCallByRetellCallId(retellCallId: string) {
  const rows = await sql`
    SELECT * FROM receptionist_calls WHERE provider_call_id = ${retellCallId} LIMIT 1
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

function strFromRetellCall(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function pickRetellWebhookPhones(call: Record<string, unknown>): { from: string | null; to: string | null } {
  const from =
    strFromRetellCall(call.from_number) ||
    strFromRetellCall(call.customer_number) ||
    strFromRetellCall(call.customer_phone) ||
    strFromRetellCall(call.from) ||
    null;
  const to =
    strFromRetellCall(call.to_number) ||
    strFromRetellCall(call.agent_number) ||
    strFromRetellCall(call.to) ||
    null;
  return { from, to };
}

/**
 * Retell browser / web test: no Twilio row exists. First webhook carries `call.call_id` — we persist it as
 * `provider_call_id` so tools (even with null call_id in JSON) can resolve via time-window fallback, and
 * phone tools can resolve once this row exists.
 */
export async function ensureReceptionistCallForRetellBrowserSession(
  retellCallId: string,
  call: Record<string, unknown>,
): Promise<{ id: string; created: boolean }> {
  const existing = await findReceptionistCallByRetellCallId(retellCallId);
  if (existing) return { id: existing.id as string, created: false };

  const agentId = strFromRetellCall(call.agent_id) || strFromRetellCall(call.agentId);
  const { from, to } = pickRetellWebhookPhones(call);
  const callStatus = strFromRetellCall(call.call_status);
  const liveStatuses = new Set(['ongoing', 'registered', 'not_connected']);
  const appStatus =
    callStatus && liveStatuses.has(callStatus.toLowerCase()) ? 'active' : 'active';

  try {
    const rows = await sql`
      INSERT INTO receptionist_calls (
        provider,
        provider_call_id,
        provider_agent_id,
        direction,
        from_phone,
        to_phone,
        status,
        mock_scenario_id,
        current_transcript_index,
        raw_provider_payload_json,
        provider_status
      )
      VALUES (
        'retell',
        ${retellCallId},
        ${agentId},
        'inbound',
        ${from},
        ${to},
        ${appStatus},
        NULL,
        0,
        ${JSON.stringify(call)},
        ${callStatus}
      )
      RETURNING id
    `;
    return { id: rows[0].id as string, created: true };
  } catch (e) {
    const again = await findReceptionistCallByRetellCallId(retellCallId);
    if (again) return { id: again.id as string, created: false };
    throw e;
  }
}

/**
 * When Retell tools omit call_id (browser test), bind to the lone in-memory Retell session:
 * provider=retell, no Twilio SID, active/ringing, within a recent window — only if exactly one match.
 */
export async function findRetellBrowserToolFallbackCallId(): Promise<{ id: string; reason: string } | null> {
  const windows = [3, 15, 60] as const;
  for (const minutes of windows) {
    const mod = `-${minutes} minutes`;
    const rows = await sql`
      SELECT id FROM receptionist_calls
      WHERE provider = ${'retell'}
        AND (twilio_call_sid IS NULL OR twilio_call_sid = '')
        AND status IN ('active', 'ringing', 'completed')
        AND datetime(updated_at) > datetime('now', ${mod})
      ORDER BY updated_at DESC
    `;
    if (rows.length === 1) {
      return {
        id: rows[0].id as string,
        reason: `fallback_unique_retell_browser_no_twilio_within_${minutes}m`,
      };
    }
  }

  const globalRows = await sql`
    SELECT id FROM receptionist_calls
    WHERE provider = ${'retell'}
      AND (twilio_call_sid IS NULL OR twilio_call_sid = '')
      AND status IN ('active', 'ringing', 'completed')
    ORDER BY updated_at DESC
  `;
  if (globalRows.length === 1) {
    return {
      id: globalRows[0].id as string,
      reason: 'fallback_globally_unique_retell_browser_no_twilio_active',
    };
  }

  return null;
}

export async function insertReceptionistToolInvocation(params: {
  callId: string;
  toolName: string;
  requestJson: unknown;
  responseJson: unknown;
  status: string;
}) {
  await sql`
    INSERT INTO receptionist_tool_invocations (call_id, tool_name, request_json, response_json, status)
    VALUES (
      ${params.callId},
      ${params.toolName},
      ${JSON.stringify(params.requestJson)},
      ${JSON.stringify(params.responseJson)},
      ${params.status}
    )
  `;
}

export async function createInboundRetellCallRow(params: {
  twilioCallSid: string;
  fromPhone: string;
  toPhone: string;
  companyId?: string | null;
}) {
  const rows = await sql`
    INSERT INTO receptionist_calls (
      company_id,
      provider,
      twilio_call_sid,
      direction,
      from_phone,
      to_phone,
      status,
      mock_scenario_id,
      current_transcript_index
    )
    VALUES (
      ${params.companyId || null},
      'retell',
      ${params.twilioCallSid},
      'inbound',
      ${params.fromPhone},
      ${params.toPhone},
      'ringing',
      NULL,
      0
    )
    RETURNING *
  `;
  return rows[0] as Record<string, unknown>;
}

export async function attachRetellRegistrationToCall(
  plumberCallId: string,
  params: {
    retellCallId: string;
    agentId: string;
    providerStatus: string;
    rawPayload?: unknown;
  },
) {
  await sql`
    UPDATE receptionist_calls SET
      provider_call_id = ${params.retellCallId},
      provider_agent_id = ${params.agentId},
      provider_status = ${params.providerStatus},
      status = 'active',
      raw_provider_payload_json = ${params.rawPayload != null ? JSON.stringify(params.rawPayload) : null},
      updated_at = datetime('now')
    WHERE id = ${plumberCallId}
  `;
}
