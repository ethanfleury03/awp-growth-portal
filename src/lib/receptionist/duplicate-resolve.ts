/**
 * Cross-call and same-call duplicate detection for receptionist outcomes (bookings, leads).
 * Deterministic heuristics only — no LLM.
 */
import { sql } from '@/lib/db';
import { tryNormalizeIssuePhrase } from '@/lib/receptionist/hardening/heuristics';
import type { ExtractedCallData } from '@/lib/receptionist/types';

export const DEFAULT_CROSS_CALL_WINDOW_HOURS = 48;
export const EMERGENCY_CROSS_CALL_WINDOW_HOURS = 6;

export function normalizePhoneDigits(input: string | null | undefined): string {
  if (!input?.trim()) return '';
  const d = input.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d.length >= 10 ? d.slice(-10) : d;
}

export function issueFingerprint(text: string | null | undefined): string {
  if (!text?.trim()) return '';
  const norm = tryNormalizeIssuePhrase(text);
  const base = (norm.normalized || text).toLowerCase();
  return base.replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function addressFingerprint(addr: string | null | undefined): string {
  if (!addr?.trim()) return '';
  return addr
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 80);
}

export type DuplicateConfidence = 'high' | 'medium' | 'low';

export interface CrossCallBookingCandidate {
  bookingId: string;
  callId: string;
  jobId: string | null;
  fromPhone: string | null;
  issueFp: string;
  addrFp: string;
  bookingType: string;
  createdAt: string;
  jobDescription: string | null;
}

function issueSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const aw = new Set(a.split(' ').filter((w) => w.length > 2));
  const bw = new Set(b.split(' ').filter((w) => w.length > 2));
  if (!aw.size || !bw.size) return 0;
  let inter = 0;
  for (const w of aw) if (bw.has(w)) inter++;
  return inter / Math.max(aw.size, bw.size);
}

/** Rank duplicate candidates for a booking request. Higher = stronger duplicate signal. */
export function rankBookingDuplicate(
  extracted: ExtractedCallData,
  phoneNorm: string,
  candidate: CrossCallBookingCandidate,
): { score: number; confidence: DuplicateConfidence; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0;
  const candPhone = normalizePhoneDigits(candidate.fromPhone);
  if (phoneNorm && candPhone && phoneNorm === candPhone) {
    score += 40;
    rationale.push('same_normalized_phone');
  }
  const exIssue = issueFingerprint(extracted.issueDescription || extracted.issueType);
  const candIssue = candidate.issueFp || issueFingerprint(candidate.jobDescription);
  const sim = issueSimilarity(exIssue, candIssue);
  if (sim >= 0.85) {
    score += 35;
    rationale.push('strong_issue_match');
  } else if (sim >= 0.45) {
    score += 18;
    rationale.push('partial_issue_match');
  }
  const exAddr = addressFingerprint(extracted.address);
  const candAddr = candidate.addrFp;
  if (exAddr && candAddr && exAddr === candAddr) {
    score += 25;
    rationale.push('same_service_address');
  }
  let confidence: DuplicateConfidence = 'low';
  if (score >= 70) confidence = 'high';
  else if (score >= 45) confidence = 'medium';
  return { score, confidence, rationale };
}

export async function listCrossCallBookingCandidates(params: {
  excludeCallId: string;
  bookingType: 'callback' | 'quote_visit';
  windowHours: number;
}): Promise<CrossCallBookingCandidate[]> {
  const mod = `-${params.windowHours} hours`;
  const rows = await sql`
    SELECT b.id AS booking_id, b.call_id, b.job_id, b.booking_type, b.created_at,
           c.from_phone, j.description AS job_description,
           c.extracted_json, c.transcript_text
    FROM receptionist_bookings b
    INNER JOIN receptionist_calls c ON c.id = b.call_id
    LEFT JOIN jobs j ON j.id = b.job_id
    WHERE b.booking_type = ${params.bookingType}
      AND b.status IN ('scheduled', 'requested')
      AND b.call_id != ${params.excludeCallId}
      AND datetime(b.created_at) > datetime('now', ${mod})
    ORDER BY b.created_at DESC
    LIMIT 80
  `;
  const out: CrossCallBookingCandidate[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    let issueFp = '';
    let addrFp = '';
    const ej = r.extracted_json as string | null;
    if (ej) {
      try {
        const ex = JSON.parse(ej) as ExtractedCallData;
        issueFp = issueFingerprint(ex.issueDescription || ex.issueType);
        addrFp = addressFingerprint(ex.address);
      } catch {
        /* ignore */
      }
    }
    if (!issueFp) {
      issueFp = issueFingerprint((r.transcript_text as string) || (r.job_description as string));
    }
    out.push({
      bookingId: r.booking_id as string,
      callId: r.call_id as string,
      jobId: (r.job_id as string) || null,
      fromPhone: (r.from_phone as string) || null,
      issueFp,
      addrFp,
      bookingType: r.booking_type as string,
      createdAt: r.created_at as string,
      jobDescription: (r.job_description as string) || null,
    });
  }
  return out;
}

export interface CrossCallLeadCandidate {
  leadId: string;
  callId: string | null;
  customerPhone: string;
  issueText: string;
  createdAt: string;
  status: string;
}

export async function listCrossCallLeadCandidates(params: {
  companyId: string;
  excludeCallId: string;
  windowHours: number;
}): Promise<CrossCallLeadCandidate[]> {
  const mod = `-${params.windowHours} hours`;
  const rows = await sql`
    SELECT l.id AS lead_id, l.issue, l.description, l.status, l.created_at,
           c.phone AS customer_phone
    FROM leads l
    INNER JOIN customers c ON c.id = l.customer_id
    WHERE l.company_id = ${params.companyId}
      AND datetime(l.created_at) > datetime('now', ${mod})
      AND l.status NOT IN ('lost', 'completed')
    ORDER BY l.created_at DESC
    LIMIT 80
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    leadId: r.lead_id as string,
    callId: null as string | null,
    customerPhone: (r.customer_phone as string) || '',
    issueText: [r.issue, r.description].filter(Boolean).join(' '),
    createdAt: r.created_at as string,
    status: r.status as string,
  }));
}

export function rankLeadDuplicate(
  extracted: ExtractedCallData,
  phoneNorm: string,
  candidate: CrossCallLeadCandidate,
): { score: number; confidence: DuplicateConfidence; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0;
  const cp = normalizePhoneDigits(candidate.customerPhone);
  if (phoneNorm && cp && phoneNorm === cp) {
    score += 45;
    rationale.push('same_customer_phone');
  }
  const exIssue = issueFingerprint(extracted.issueDescription || extracted.issueType);
  const candIssue = issueFingerprint(candidate.issueText);
  const sim = issueSimilarity(exIssue, candIssue);
  if (sim >= 0.8) {
    score += 40;
    rationale.push('strong_issue_match');
  } else if (sim >= 0.4) {
    score += 15;
    rationale.push('partial_issue_match');
  }
  let confidence: DuplicateConfidence = 'low';
  if (score >= 70) confidence = 'high';
  else if (score >= 50) confidence = 'medium';
  return { score, confidence, rationale };
}

/** Last successful tool response for idempotent retries (same call + tool). */
export async function getLastSuccessfulToolPayload(
  callId: string,
  toolName: string,
): Promise<Record<string, unknown> | null> {
  const rows = await sql`
    SELECT response_json FROM receptionist_tool_invocations
    WHERE call_id = ${callId} AND tool_name = ${toolName} AND status = 'ok'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const raw = rows[0]?.response_json as string | undefined;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function countPriorToolSuccess(callId: string, toolName: string): Promise<number> {
  const row = await sql`
    SELECT COUNT(*) AS c FROM receptionist_tool_invocations
    WHERE call_id = ${callId} AND tool_name = ${toolName} AND status = 'ok'
  `;
  return Number((row[0] as { c?: number })?.c || 0);
}
