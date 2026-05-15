import { describe, expect, it } from 'vitest';
import { shouldRouteRootToPortalApp } from './portal-entry-host';

describe('portal app entry host routing', () => {
  it('routes root traffic into the app', () => {
    expect(shouldRouteRootToPortalApp('/')).toBe(true);
  });

  it('routes legacy marketing traffic into the app', () => {
    expect(shouldRouteRootToPortalApp('/features')).toBe(true);
    expect(shouldRouteRootToPortalApp('/pricing/')).toBe(true);
    expect(shouldRouteRootToPortalApp('/website-growth')).toBe(true);
  });

  it('leaves non-root traffic alone', () => {
    expect(shouldRouteRootToPortalApp('/sign-in')).toBe(false);
    expect(shouldRouteRootToPortalApp('/app')).toBe(false);
    expect(shouldRouteRootToPortalApp('/legal/privacy')).toBe(false);
  });
});
