/**
 * Deterministic caller → existing customer / lead / prior call linkage.
 */
import { sql } from '@/lib/db';
import {
  issueFingerprint,
  normalizePhoneDigits,
} from '@/lib/receptionist/duplicate-resolve';
import type { ExtractedCallData } from '@/lib/receptionist/types';

export type CallerLinkageOutcome =
  | 'exact_customer_match'
  | 'exact_lead_match'
  | 'existing_open_case_match'
  | 'probable_match_needs_review'
  | 'no_match';

export interface CallerLinkageResult {
  outcome: CallerLinkageOutcome;
  customerId?: string;
  leadId?: string;
  priorCallId?: string;
  rationale: string[];
}

export async function matchCallerToExistingEntities(params: {
  companyId: string;
  excludeCallId: string;
  fromPhone: string | null | undefined;
  extracted: ExtractedCallData;
}): Promise<CallerLinkageResult> {
  const rationale: string[] = [];
  const phoneNorm = normalizePhoneDigits(params.extracted.phone || params.fromPhone || '');
  if (!phoneNorm || phoneNorm.length < 10) {
    return { outcome: 'no_match', rationale: ['no_usable_phone_for_match'] };
  }

  const customers = await sql`
    SELECT id, name, phone, address FROM customers
    WHERE company_id = ${params.companyId}
    LIMIT 500
  `;
  const customerHits = (customers as Record<string, unknown>[]).filter(
    (c) => normalizePhoneDigits(c.phone as string) === phoneNorm,
  );
  if (customerHits.length === 1) {
    const cid = customerHits[0].id as string;
    rationale.push('single_exact_customer_phone_match');
    const openLeads = await sql`
      SELECT id FROM leads
      WHERE company_id = ${params.companyId} AND customer_id = ${cid}
        AND status NOT IN ('lost', 'completed')
      ORDER BY updated_at DESC LIMIT 1
    `;
    if (openLeads.length) {
      return {
        outcome: 'exact_lead_match',
        customerId: cid,
        leadId: openLeads[0].id as string,
        rationale: [...rationale, 'open_lead_for_same_customer'],
      };
    }
    return { outcome: 'exact_customer_match', customerId: cid, rationale };
  }
  if (customerHits.length > 1) {
    return {
      outcome: 'probable_match_needs_review',
      rationale: ['multiple_customers_share_normalized_phone'],
    };
  }

  const leads = await sql`
    SELECT l.id, l.issue, l.customer_id, c.phone
    FROM leads l
    INNER JOIN customers c ON c.id = l.customer_id
    WHERE l.company_id = ${params.companyId}
      AND l.status NOT IN ('lost', 'completed')
    ORDER BY l.updated_at DESC
    LIMIT 200
  `;
  const leadPhoneMatches = (leads as Record<string, unknown>[]).filter(
    (l) => normalizePhoneDigits(l.phone as string) === phoneNorm,
  );
  if (leadPhoneMatches.length === 1) {
    const row = leadPhoneMatches[0];
    rationale.push('exact_lead_phone_match');
    return {
      outcome: 'exact_lead_match',
      leadId: row.id as string,
      customerId: (row.customer_id as string) || undefined,
      rationale,
    };
  }

  const exFp = issueFingerprint(params.extracted.issueDescription || params.extracted.issueType);
  if (exFp && leadPhoneMatches.length > 1) {
    let best: { id: string; customer_id: string | null; score: number } | null = null;
    for (const l of leadPhoneMatches) {
      const fp = issueFingerprint(`${l.issue}`);
      const score = exFp === fp ? 1 : exFp.includes(fp) || fp.includes(exFp) ? 0.7 : 0;
      if (!best || score > best.score) {
        best = { id: l.id as string, customer_id: (l.customer_id as string) || null, score };
      }
    }
    if (best && best.score >= 0.7) {
      rationale.push('lead_disambiguated_by_issue_fingerprint');
      return {
        outcome: 'exact_lead_match',
        leadId: best.id,
        customerId: best.customer_id || undefined,
        rationale,
      };
    }
  }

  const prior = await sql`
    SELECT id, extracted_json, disposition, status
    FROM receptionist_calls
    WHERE id != ${params.excludeCallId}
      AND datetime(created_at) > datetime('now', '-72 hours')
      AND status = 'completed'
      AND disposition NOT IN ('spam')
    ORDER BY created_at DESC
    LIMIT 40
  `;
  for (const row of prior as Record<string, unknown>[]) {
    const fp = row.from_phone as string | null;
    if (normalizePhoneDigits(fp) !== phoneNorm) continue;
    let sameIssue = false;
    const ej = row.extracted_json as string | null;
    if (ej && exFp) {
      try {
        const ex = JSON.parse(ej) as ExtractedCallData;
        const pfp = issueFingerprint(ex.issueDescription || ex.issueType);
        sameIssue = Boolean(pfp && exFp && (pfp === exFp || pfp.includes(exFp) || exFp.includes(pfp)));
      } catch {
        /* ignore */
      }
    }
    if (sameIssue && row.disposition === 'follow_up_needed') {
      rationale.push('prior_unresolved_call_same_phone_and_issue');
      return {
        outcome: 'existing_open_case_match',
        priorCallId: row.id as string,
        rationale,
      };
    }
  }

  if (leadPhoneMatches.length > 1) {
    return {
      outcome: 'probable_match_needs_review',
      rationale: ['multiple_open_leads_same_phone'],
    };
  }

  return { outcome: 'no_match', rationale: ['no_deterministic_match'] };
}
