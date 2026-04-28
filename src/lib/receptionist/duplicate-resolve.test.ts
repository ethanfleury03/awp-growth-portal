import { describe, expect, it } from 'vitest';
import { issueFingerprint, normalizePhoneDigits } from '@/lib/receptionist/duplicate-resolve';

describe('duplicate-resolve', () => {
  it('normalizes US phone digits', () => {
    expect(normalizePhoneDigits('+1 (555) 123-4567')).toBe('5551234567');
    expect(normalizePhoneDigits('5551234567')).toBe('5551234567');
  });

  it('issue fingerprint collapses whitespace', () => {
    const a = issueFingerprint('Burst  PIPE  leak');
    const b = issueFingerprint('burst pipe leak');
    expect(a.length).toBeGreaterThan(0);
    expect(a).toBe(b);
  });
});
