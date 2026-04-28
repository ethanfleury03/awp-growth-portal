import { sql } from '@/lib/db';
import { normalizeVagueTimingPhrase } from '@/lib/receptionist/hardening/timing';
import type { ExtractedCallData } from '@/lib/receptionist/types';

async function getOrCreateCompanyId(explicit?: string | null) {
  if (explicit) return explicit;
  const companies = await sql`SELECT id FROM companies ORDER BY created_at ASC LIMIT 1`;
  if (companies.length > 0) return companies[0].id as string;
  const row = await sql`
    INSERT INTO companies (name, email)
    VALUES ('Demo Company', 'demo@plumberos.com')
    RETURNING id
  `;
  return row[0].id as string;
}

/** Next business day date YYYY-MM-DD for rough scheduling */
function addDaysYmd(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function createCustomerAndLeadFromExtracted(
  companyId: string,
  extracted: ExtractedCallData,
  source = 'ai_receptionist',
) {
  const phoneRaw = extracted.phone || 'unknown';
  let customerId: string | null = null;

  const existing = await sql`
    SELECT id FROM customers
    WHERE company_id = ${companyId} AND phone = ${phoneRaw}
    LIMIT 1
  `;
  if (existing.length > 0) {
    customerId = existing[0].id as string;
  }

  if (!customerId) {
    const cust = await sql`
      INSERT INTO customers (company_id, name, phone, address)
      VALUES (
        ${companyId},
        ${extracted.callerName || 'Unknown caller'},
        ${phoneRaw},
        ${extracted.address || null}
      )
      RETURNING id
    `;
    customerId = cust[0].id as string;
  }

  const issue = extracted.issueType || 'Plumbing service request';
  const description = [
    extracted.issueDescription,
    extracted.preferredCallbackWindow ? `Callback: ${extracted.preferredCallbackWindow}` : null,
    extracted.preferredVisitWindow ? `Visit: ${extracted.preferredVisitWindow}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const priority =
    extracted.urgency === 'emergency' ? 1 : extracted.urgency === 'high' ? 2 : 3;

  const leadRows = await sql`
    INSERT INTO leads (company_id, customer_id, source, status, priority, issue, description, location, ai_qualification)
    VALUES (
      ${companyId},
      ${customerId},
      ${source},
      ${extracted.emergencyDetected ? 'qualified' : 'new'},
      ${priority},
      ${issue},
      ${description || null},
      ${extracted.address || null},
      ${JSON.stringify({ receptionist: extracted })}
    )
    RETURNING *
  `;

  return { customerId, lead: leadRows[0] };
}

export async function createJobForBooking(params: {
  companyId: string;
  leadId?: string | null;
  customerId?: string | null;
  type: string;
  description: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  notes?: string | null;
}) {
  const rows = await sql`
    INSERT INTO jobs (
      company_id, lead_id, customer_id, status, type, description,
      scheduled_date, scheduled_time, notes
    )
    VALUES (
      ${params.companyId},
      ${params.leadId || null},
      ${params.customerId || null},
      'scheduled',
      ${params.type},
      ${params.description},
      ${params.scheduledDate},
      ${params.scheduledTime},
      ${params.notes || null}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function createCallLogForReceptionistCall(params: {
  companyId: string;
  customerName: string | null;
  phoneNumber: string;
  durationSeconds: number;
  transcript: string;
  aiSummary: string;
  outcome: string | null;
  leadId?: string | null;
  jobId?: string | null;
  customerId?: string | null;
  recording: boolean;
}) {
  const rows = await sql`
    INSERT INTO call_logs (
      company_id,
      customer_id,
      lead_id,
      job_id,
      customer_name,
      phone_number,
      duration_seconds,
      status,
      transcript,
      ai_summary,
      outcome,
      recording
    )
    VALUES (
      ${params.companyId},
      ${params.customerId || null},
      ${params.leadId || null},
      ${params.jobId || null},
      ${params.customerName},
      ${params.phoneNumber},
      ${params.durationSeconds},
      'completed',
      ${params.transcript},
      ${params.aiSummary},
      ${params.outcome},
      ${params.recording ? 1 : 0}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function linkReceptionistCallToCallLog(
  receptionistCallId: string,
  callLogId: string,
) {
  await sql`
    UPDATE receptionist_calls
    SET call_log_id = ${callLogId}, updated_at = datetime('now')
    WHERE id = ${receptionistCallId}
  `;
}

/**
 * Resolve the company that owns the inbound Twilio number for a receptionist
 * call. Preference order:
 *   1. `companies.twilio_phone_number` exact match (legacy single-number setup).
 *   2. `company_phone_numbers.phone_e164` (multi-number setup).
 *   3. Fallback to the first/demo company (dev/test only).
 *
 * The `toPhone` arg is the E.164 number Twilio dialed (the `To` param on the
 * inbound voice webhook). Pass null to deliberately fall back.
 */
export async function getCompanyIdForReceptionist(toPhone?: string | null) {
  if (toPhone) {
    const normalized = toPhone.trim();
    try {
      const phoneRows = await sql`
        SELECT company_id FROM company_phone_numbers
        WHERE phone_e164 = ${normalized}
        LIMIT 1
      `;
      if (phoneRows.length > 0) {
        return String((phoneRows[0] as Record<string, unknown>).company_id);
      }
    } catch {
      // Table may not exist on older DBs; fall through to default company.
    }
  }
  return getOrCreateCompanyId(null);
}

/** Heuristic schedule from extracted windows (mock-friendly defaults). */
export function suggestScheduleForBooking(
  bookingType: 'callback' | 'quote_visit',
  extracted: ExtractedCallData,
  timeZone = 'America/Toronto',
) {
  const windowText =
    bookingType === 'callback'
      ? extracted.preferredCallbackWindow || ''
      : extracted.preferredVisitWindow || extracted.preferredCallbackWindow || '';
  const hint = normalizeVagueTimingPhrase(windowText || 'tomorrow morning', timeZone);
  const text = `${extracted.preferredCallbackWindow || ''} ${extracted.preferredVisitWindow || ''}`.toLowerCase();
  let scheduledDate = addDaysYmd(1);
  let scheduledTime = bookingType === 'callback' ? '09:00' : '10:00';

  if (hint.localWindowLabel) {
    const m = hint.localWindowLabel.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) scheduledDate = m[1];
  }

  if (text.includes('tomorrow')) {
    scheduledDate = addDaysYmd(1);
  }
  if (text.includes('next week')) {
    scheduledDate = addDaysYmd(7);
  }
  if (text.includes('friday')) {
    scheduledDate = addDaysYmd(5);
  }
  if (text.includes('afternoon') || hint.summary.toLowerCase().includes('afternoon')) {
    scheduledTime = '14:00';
  }
  if (text.includes('morning') || hint.summary.toLowerCase().includes('morning')) {
    scheduledTime = '09:00';
  }
  if (hint.kind === 'asap_urgent') {
    scheduledDate = addDaysYmd(0);
    scheduledTime = bookingType === 'callback' ? '10:00' : '11:00';
  }

  return { scheduledDate, scheduledTime };
}
