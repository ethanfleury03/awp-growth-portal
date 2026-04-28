import type { ReceptionistCallMeta } from '@/lib/receptionist/hardening/types';

export function parseReceptionistMeta(raw: string | null | undefined): ReceptionistCallMeta {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as ReceptionistCallMeta;
  } catch {
    return {};
  }
}

export function mergeReceptionistMeta(
  existing: string | null | undefined,
  patch: Partial<ReceptionistCallMeta>,
): string {
  const base = parseReceptionistMeta(existing);
  const next: ReceptionistCallMeta = { ...base, ...patch };
  if (patch.confirmations) {
    next.confirmations = { ...base.confirmations, ...patch.confirmations };
  }
  if (patch.completeness !== undefined) {
    next.completeness = patch.completeness;
  }
  if (patch.fieldConfidence) {
    next.fieldConfidence = { ...base.fieldConfidence, ...patch.fieldConfidence };
  }
  if (patch.toolFallbacks && base.toolFallbacks) {
    next.toolFallbacks = [...base.toolFallbacks, ...patch.toolFallbacks];
  }
  if (patch.duplicateNotes && base.duplicateNotes) {
    next.duplicateNotes = [...new Set([...base.duplicateNotes, ...patch.duplicateNotes])];
  }
  if (patch.spamRationale && base.spamRationale) {
    next.spamRationale = [...new Set([...base.spamRationale, ...patch.spamRationale])];
  }
  if (patch.staffWorkflow) {
    next.staffWorkflow = { ...base.staffWorkflow, ...patch.staffWorkflow };
  }
  if (patch.duplicateResolution !== undefined) {
    next.duplicateResolution = patch.duplicateResolution;
  }
  if (patch.callerLinkage !== undefined) {
    next.callerLinkage = patch.callerLinkage;
  }
  if (patch.caseRecord !== undefined) {
    next.caseRecord = patch.caseRecord;
  }
  next.version = 3;
  return JSON.stringify(next);
}
