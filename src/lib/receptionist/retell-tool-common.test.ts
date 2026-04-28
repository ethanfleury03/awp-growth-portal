import { describe, expect, it } from 'vitest';
import {
  hasExplicitRetellCallBindingAttempt,
  normalizeRetellToolBody,
} from '@/lib/receptionist/retell-tool-common';

describe('Retell browser / null-id tool payloads', () => {
  it('does not treat null call_id as an explicit binding attempt (fallback allowed)', () => {
    const body = normalizeRetellToolBody({ call_id: null, args: { phone: 'x' } });
    expect(hasExplicitRetellCallBindingAttempt(body)).toBe(false);
  });

  it('treats nested retell call id as explicit binding', () => {
    const body = normalizeRetellToolBody({ args: { call_id: 'call_xyz' } });
    expect(hasExplicitRetellCallBindingAttempt(body)).toBe(true);
  });
});
