import { describe, expect, it } from 'vitest';
import { normalizeGatewayRole, shouldVerifyGatewayAccess } from './portal-user';

describe('portal user gateway enrichment', () => {
  it('does not let gateway verification override an assigned local portal user', () => {
    expect(shouldVerifyGatewayAccess(true, 'portal_user_1', 'company_1')).toBe(false);
    expect(shouldVerifyGatewayAccess(true, 'portal_user_1', '')).toBe(true);
    expect(shouldVerifyGatewayAccess(false, null, '')).toBe(false);
  });

  it('preserves gateway super admins as super admins', () => {
    expect(normalizeGatewayRole('super_admin')).toBe('super_admin');
    expect(normalizeGatewayRole('owner')).toBe('admin');
  });
});
