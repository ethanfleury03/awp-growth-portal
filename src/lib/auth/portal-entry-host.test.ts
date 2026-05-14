import { describe, expect, it } from 'vitest';
import { shouldRouteRootToPortalApp } from './portal-entry-host';

describe('portal app entry host routing', () => {
  it('routes root traffic into the app', () => {
    expect(shouldRouteRootToPortalApp('/')).toBe(true);
  });

  it('leaves non-root traffic alone', () => {
    expect(shouldRouteRootToPortalApp('/features')).toBe(false);
    expect(shouldRouteRootToPortalApp('/sign-in')).toBe(false);
    expect(shouldRouteRootToPortalApp('/app')).toBe(false);
  });
});
