/**
 * Receptionist evaluation scorecard — deterministic checks for scenarios.
 * Run: npm run receptionist:eval
 */
import { describe, expect, it } from 'vitest';
import { decideDisposition, extractCallFieldsFromTranscript, parseEmergencyKeywordsJson } from '@/lib/receptionist/extract';
import { getScenarioById } from '@/lib/receptionist/scenarios';
import {
  issueFingerprint,
  normalizePhoneDigits,
  rankBookingDuplicate,
  rankLeadDuplicate,
} from '@/lib/receptionist/duplicate-resolve';
import { buildReceptionistCaseRecord } from '@/lib/receptionist/case-synthesize';
import type { ReceptionistCallMeta } from '@/lib/receptionist/hardening/types';
import type { ExtractedCallData } from '@/lib/receptionist/types';

const keywords = parseEmergencyKeywordsJson(JSON.stringify(['burst pipe', 'flooding']));

interface ScenarioExpectation {
  id: string;
  label: string;
  minDisposition?: string;
  notes: string[];
}

function scoreScenario(exp: ScenarioExpectation): { pass: boolean; criteria: Record<string, boolean>; score: number } {
  const scenario = getScenarioById(exp.id);
  if (!scenario) {
    return { pass: false, criteria: { scenario_exists: false }, score: 0 };
  }
  const transcript = scenario.turns.map((t) => `${t.speaker}: ${t.text}`).join('\n');
  const extracted = extractCallFieldsFromTranscript(transcript, scenario, keywords);
  const disposition = decideDisposition(extracted, scenario);
  const dispOk = exp.minDisposition ? disposition === exp.minDisposition : true;
  const criteria: Record<string, boolean> = {
    scenario_exists: true,
    disposition_ok: dispOk,
    has_summary: Boolean(extracted.summary?.trim()),
  };
  const pass = Object.values(criteria).every(Boolean);
  const score = Object.values(criteria).filter(Boolean).length / Object.keys(criteria).length;
  return { pass, criteria, score };
}

describe('receptionist eval scorecard', () => {
  it('scores bundled mock scenarios', () => {
    const scenarios: ScenarioExpectation[] = [
      { id: 'mock-burst-pipe', label: 'Emergency', minDisposition: 'emergency', notes: [] },
      { id: 'mock-callback-tomorrow', label: 'Callback', minDisposition: 'callback_booked', notes: [] },
      { id: 'mock-faucet-quote', label: 'Quote', minDisposition: 'quote_visit_booked', notes: [] },
      { id: 'mock-spam', label: 'Spam', minDisposition: 'spam', notes: [] },
    ];
    const results = scenarios.map((s) => ({ id: s.id, ...scoreScenario(s) }));
    const report = results.map((r) => `${r.id}: ${r.pass ? 'PASS' : 'FAIL'} (${(r.score * 100).toFixed(0)}%)`);
    expect(report.join('\n')).toBeTruthy();
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0.5);
    }
  });

  it('duplicate ranking prefers same phone + issue', () => {
    const extracted: ExtractedCallData = {
      callerName: 'A',
      phone: '(555) 111-2222',
      address: '123 Main St',
      issueType: 'leak',
      issueDescription: 'kitchen pipe leak',
      urgency: 'medium',
      preferredCallbackWindow: null,
      preferredVisitWindow: null,
      emergencyDetected: false,
      existingCustomerPossible: false,
      spamLikely: false,
      summary: '',
      nextStep: '',
    };
    const rank = rankBookingDuplicate(extracted, normalizePhoneDigits('5551112222'), {
      bookingId: 'b1',
      callId: 'c1',
      jobId: 'j1',
      fromPhone: '555-111-2222',
      issueFp: issueFingerprint('kitchen leak pipe'),
      addrFp: '',
      bookingType: 'callback',
      createdAt: '',
      jobDescription: null,
    });
    expect(rank.score).toBeGreaterThan(40);
  });

  it('lead duplicate ranking', () => {
    const extracted: ExtractedCallData = {
      callerName: 'B',
      phone: '5551112222',
      address: null,
      issueType: 'clog',
      issueDescription: 'drain clog',
      urgency: 'medium',
      preferredCallbackWindow: null,
      preferredVisitWindow: null,
      emergencyDetected: false,
      existingCustomerPossible: false,
      spamLikely: false,
      summary: '',
      nextStep: '',
    };
    const r = rankLeadDuplicate(extracted, normalizePhoneDigits('5551112222'), {
      leadId: 'l1',
      callId: null,
      customerPhone: '+1 (555) 111-2222',
      issueText: 'drain clog bathroom',
      createdAt: '',
      status: 'new',
    });
    expect(r.score).toBeGreaterThan(40);
  });

  it('case synthesis produces staff action string', () => {
    const meta: ReceptionistCallMeta = { operationalPriority: 'standard' };
    const ex: ExtractedCallData = {
      callerName: 'C',
      phone: '5550001111',
      address: null,
      issueType: 'test',
      issueDescription: 'test issue',
      urgency: 'medium',
      preferredCallbackWindow: null,
      preferredVisitWindow: null,
      emergencyDetected: false,
      existingCustomerPossible: false,
      spamLikely: false,
      summary: 'short',
      nextStep: '',
    };
    const rec = buildReceptionistCaseRecord({
      transcript: 'Caller: hi',
      aiSummary: 'summary',
      recommendedNextStep: 'Call back',
      fromPhone: '5550001111',
      extracted: ex,
      disposition: 'follow_up_needed',
      meta,
      callerLinkage: { outcome: 'no_match', rationale: [] },
      toolSummary: [],
      hasEmergencyEvent: false,
    });
    expect(rec.recommendedStaffAction.length).toBeGreaterThan(3);
    expect(rec.version).toBe(1);
  });
});
